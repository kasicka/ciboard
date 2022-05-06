/*
 * This file is part of ciboard

 * Copyright (c) 2021 Andrei Stepanov <astepano@redhat.com>
 * 
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import _ from 'lodash';
import * as React from 'react';
import pako from 'pako';
import moment from 'moment';
import { Buffer } from 'buffer';
import 'moment-duration-format';
import { useQuery } from '@apollo/client';
import { useState, memo, useEffect } from 'react';
import { xunitParser } from '../utils/xunitParser';
import {
    Flex,
    Text,
    Alert,
    Title,
    Spinner,
    TextContent,
    FlexItem,
    Checkbox,
    DataList,
    DataListItem,
    DataListItemRow,
    DataListCell,
    DataListToggle,
    DataListContent,
    DataListItemCells,
} from '@patternfly/react-core';
import {
    Table,
    cellWidth,
    TableBody,
    TableHeader,
    TableVariant,
    IRow,
} from '@patternfly/react-table';

import { Artifact, StateKaiType } from '../artifact';
import { renderStatusIcon } from '../utils/artifactUtils';
import { ArtifactsXunitQuery } from '../queries/Artifacts';
import { mkSeparatedList } from '../utils/artifactsTable';

type TestCaseType = {
    _uuid: string;
    name: string;
    time: string;
    logs: TestCaseLogsType[];
    status: TestCaseStatusNameType;
    phases: TestCasePhasesType[];
    message: string;
    properties: TestCasePropertiesType[];
    'test-outputs': TestCaseTestOutputsType[];
};

type TestCaseStatusNameType = 'error' | 'fail' | 'pass' | 'skip';

type TestCaseLogsType = { log: TestCaseLogsEntryType[] };
type TestCaseLogsEntryType = { $: { name: string; href: string } };

type TestCaseTestOutputsType = {
    'test-output': TestCaseTestOutputsEntryType[];
};
type TestCaseTestOutputsEntryType = {
    $: { result: string; remedy: string; message: string };
};

type TestCasePhasesType = { phase: TestCasePhasesEntryType[] };
type TestCasePhasesEntryType = {
    $: { name: string; result: string };
    logs: TestCaseLogsType[];
};

type TestCasePropertiesType = { property: TestCasePropertiesEntryType[] };
type TestCasePropertiesEntryType = { $: { name: string; value: string } };

type TestSuitePropertiesType = {
    property: TestSuitePropertiesEntryType[];
};
type TestSuitePropertiesEntryType = { $: { name: string; value: string } };

type TestSuiteType = {
    _uuid: string;
    name: string;
    time?: string;
    tests: TestCaseType[];
    status: string;
    properties: TestSuitePropertiesType[];
    count: {
        pass?: number;
        fail?: number;
        skip?: number;
        error?: number;
        tests?: number;
    };
};

type TestSuiteCountType = TestSuiteType['count'];
type TestSuiteCountNamesType = keyof TestSuiteCountType;

interface TestsuitesProps {
    xunit: TestSuiteType[];
}

const Testsuites: React.FC<TestsuitesProps> = (props) => {
    const { xunit } = props;
    const testsuites = [];
    if (xunit.length === 0) {
        testsuites.push(<p>Error: unable to parse xunit, seems invalid.</p>);
    }
    for (const suite of xunit) {
        testsuites.push(
            <Flex key={suite._uuid}>
                <FlexItem>
                    <TextContent>
                        <Title headingLevel="h4" size="lg">
                            {suite.name}
                        </Title>
                    </TextContent>
                </FlexItem>
                <FlexItem>
                    <Testsuite suite={suite} />
                </FlexItem>
            </Flex>,
        );
    }
    return <>{testsuites}</>;
};

const getProperty = (
    properties: Array<TestCasePropertiesType | TestSuitePropertiesType>,
    propertyName: string,
) => {
    if (!properties) return null;
    for (const property of properties[0].property) {
        if (property.$.name === propertyName) return property.$.value;
    }
    return null;
};

const mkLogName = (log: TestCaseLogsEntryType): IRow => {
    return {
        cells: [
            <>
                <a href={log.$.href} target="_blank" rel="noopener noreferrer">
                    {log.$.name}
                </a>
            </>,
        ],
    };
};

interface TestCaseLogsProps {
    logs: TestCaseLogsType[];
}

const TestCaseLogs: React.FC<TestCaseLogsProps> = (props) => {
    const { logs } = props;
    if (!logs || !logs[0].log) {
        return null;
    }
    const all_logs = logs[0].log;
    const rows: IRow[] = [];
    _.map(all_logs, (log) => rows.push(mkLogName(log)));
    return (
        <Table
            aria-label="Test logs"
            variant={TableVariant.compact}
            borders={false}
            sortBy={{}}
            cells={[{ title: 'Logs' }]}
            rows={rows}
        >
            <TableHeader />
            <TableBody />
        </Table>
    );
};

const mkLogsLinks = (logs: TestCaseLogsType[]): JSX.Element[] => {
    /** logs[0].log - [log1, log2, log3] */
    if (!logs[0] || !logs[0].log) {
        return [];
    }
    return logs[0].log.map((l) => (
        <a
            key={l.$.name}
            href={l.$.href}
            target="_blank"
            rel="noopener noreferrer"
        >
            {l.$.name}
        </a>
    ));
};

const mkPhase = (phase: TestCasePhasesEntryType): IRow => {
    return {
        cells: [
            renderStatusIcon(phase.$.result),
            phase.$.name,
            mkSeparatedList(mkLogsLinks(phase.logs)),
        ],
    };
};

interface TestCasePhasesProps {
    phases: TestCasePhasesType[];
}

const TestCasePhases: React.FC<TestCasePhasesProps> = (props) => {
    const { phases } = props;
    if (!phases || !phases[0].phase) {
        return null;
    }
    const all_phases = phases[0].phase;
    const rows: IRow[] = [];
    _.map(all_phases, (phase) => rows.push(mkPhase(phase)));
    return (
        <Table
            aria-label="Test phases"
            variant={TableVariant.compact}
            borders={false}
            sortBy={{}}
            cells={[
                { title: '', transforms: [cellWidth(10)] },
                { title: 'Phases', transforms: [cellWidth(50)] },
                { title: 'Links' },
            ]}
            rows={rows}
        >
            <TableHeader />
            <TableBody />
        </Table>
    );
};

const mkTestOutput = (output: TestCaseTestOutputsEntryType): IRow => {
    /** $.message / $.remedy / $.result */
    return {
        cells: [
            <>{output.$.result}</>,
            <>{output.$.message}</>,
            <>{output.$.remedy}</>,
        ],
    };
};

interface TestCaseOutputProps {
    outputs: TestCaseTestOutputsType[];
}
const TestCaseOutput: React.FC<TestCaseOutputProps> = (props) => {
    const { outputs } = props;
    if (!outputs || !outputs[0]['test-output']) {
        return null;
    }
    const all_outputs = outputs[0]['test-output'];
    const rows: IRow[] = [];
    _.map(all_outputs, (output) => rows.push(mkTestOutput(output)));
    return (
        <Table
            aria-label="Test output"
            variant={TableVariant.compact}
            borders={false}
            sortBy={{}}
            cells={[
                { title: 'Result', transforms: [cellWidth(15)] },
                { title: 'Test output', transforms: [cellWidth(50)] },
                { title: 'Remedy', transforms: [cellWidth(45)] },
            ]}
            rows={rows}
        >
            <TableHeader />
            <TableBody />
        </Table>
    );
};

function mkProperties(property: TestCasePropertiesEntryType) {
    /** property == [{}, {}, {}, {}] == [{$: {name: xxx, value: yyy}}] */
    return {
        cells: [
            <Text>{property.$.name}</Text>,
            <Text>{property.$.value}</Text>,
        ],
    };
}

interface TestCasePropertiesProps {
    properties: TestCasePropertiesType[];
}

const TestCaseProperties: React.FC<TestCasePropertiesProps> = (props) => {
    const { properties } = props;
    if (!properties || !properties[0].property) {
        return null;
    }
    const all_properties = properties[0].property;
    const rows: IRow[] = [];
    _.map(all_properties, (p) => rows.push(mkProperties(p)));
    return (
        <Table
            aria-label="Properties"
            variant={TableVariant.compact}
            borders={false}
            sortBy={{}}
            cells={[
                { title: 'Property', transforms: [cellWidth(20)] },
                { title: 'Value' },
            ]}
            rows={rows}
        >
            <TableHeader />
            <TableBody />
        </Table>
    );
};

interface TestCaseContentProps {
    test: TestCaseType;
}

const TestCaseContent: React.FC<TestCaseContentProps> = (props) => {
    const { test } = props;
    return (
        <>
            <TestCaseOutput outputs={test['test-outputs']} />
            <TestCaseLogs logs={test.logs} />
            <TestCasePhases phases={test.phases} />
            <TestCaseProperties properties={test.properties} />
        </>
    );
};

interface TestCaseProps {
    test: TestCaseType;
}

const TestCase: React.FC<TestCaseProps> = (props) => {
    const { test } = props;
    const [expanded, setExpanded] = useState(false);
    const version = getProperty(test.properties, 'baseosci.beaker-version');
    const time = test.time
        ? moment
              .duration(parseInt(test.time, 10), 'seconds')
              .format('hh:mm:ss', { trim: false })
        : '';

    const toggle = () => {
        setExpanded(!expanded);
    };

    return (
        <DataListItem isExpanded={expanded}>
            <DataListItemRow>
                <DataListToggle
                    id={test._uuid}
                    isExpanded={expanded}
                    onClick={toggle}
                />
                <DataListItemCells
                    className="pf-u-m-0 pf-u-p-0"
                    dataListCells={
                        <>
                            <DataListCell isIcon>
                                {renderStatusIcon(test.status)}
                            </DataListCell>
                            <DataListCell wrapModifier="nowrap">
                                <TextContent>
                                    <Text>{test.name}</Text>
                                </TextContent>
                            </DataListCell>
                            <DataListCell>{version}</DataListCell>
                            <DataListCell alignRight={true} isFilled={false}>
                                {time}
                            </DataListCell>
                        </>
                    }
                />
            </DataListItemRow>
            <DataListContent
                aria-label="Test case content"
                id={test._uuid}
                isHidden={!expanded}
            >
                <TestCaseContent test={test} />
            </DataListContent>
        </DataListItem>
    );
};

interface TestsuiteProps {
    suite: TestSuiteType;
}

type ToggleStateType = Partial<Record<TestSuiteCountNamesType, boolean>>;

const default_toggle_state: ToggleStateType = {
    fail: true,
    skip: true,
    pass: false,
    error: true,
};

const Testsuite: React.FC<TestsuiteProps> = (props) => {
    const { suite } = props;

    const initialToggleState = _.pickBy(
        default_toggle_state,
        (_value, key) =>
            _.toNumber(suite.count[key as TestSuiteCountNamesType]) > 0,
    ) as ToggleStateType;

    const [toggleState, setToggleState] =
        useState<ToggleStateType>(initialToggleState);

    const toggle = (outcome: TestSuiteCountNamesType, isChecked: boolean) => {
        setToggleState({ ...toggleState, [outcome]: !isChecked });
    };

    if (!suite.tests || suite.tests.length === 0) {
        return (
            <Alert isInline isPlain variant="warning" title="No xunit">
                Test does not provide detailed results via xunit. Please go to
                the CI system log and investigate the produced test artifacts.
            </Alert>
        );
    }
    return (
        <>
            <Flex>
                {_.map(
                    toggleState,
                    (isChecked, outcome: TestSuiteCountNamesType) => {
                        if (_.isNil(isChecked)) return <></>;
                        const label = (
                            <>
                                {renderStatusIcon(outcome)}{' '}
                                {suite.count[outcome]}
                            </>
                        );
                        return (
                            <FlexItem key={outcome}>
                                <Checkbox
                                    aria-label={`Toggle display of results in status ${outcome}`}
                                    id={`check-${outcome}-${suite._uuid}`}
                                    isChecked={isChecked}
                                    label={label}
                                    name={outcome}
                                    onChange={() => toggle(outcome, isChecked)}
                                />
                            </FlexItem>
                        );
                    },
                )}
            </Flex>

            <DataList aria-label="Test suite items" isCompact>
                {_.map(suite.tests, (test, index) => {
                    if (toggleState[test.status]) {
                        return <TestCase key={index} test={test} />;
                    }
                })}
            </DataList>
        </>
    );
};

const NoXunit = () => {
    return (
        <Alert isInline isPlain variant="info" title="No results in xunit">
            Test does not provide detailed results via xunit. Please go to the
            log and investigate the produced test artifacts.
        </Alert>
    );
};

interface TestSuitesProps {
    state: StateKaiType;
    artifact: Artifact;
}
const TestSuites_: React.FC<TestSuitesProps> = (props) => {
    const { state, artifact } = props;
    const { kai_state } = state;
    const { msg_id } = kai_state;
    const [xunit, setXunit] = useState<string>('');
    const [xunitProcessed, setXunitProcessed] = useState(false);
    /** why do we need msgError? */
    const [msgError, setError] = useState<JSX.Element>();
    const { loading, data } = useQuery(ArtifactsXunitQuery, {
        variables: {
            msg_id,
            dbFieldName1: 'aid',
            atype: artifact.type,
            dbFieldValues1: [artifact.aid],
        },
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
        notifyOnNetworkStatusChange: true,
    });
    /** Even there is an error there could be data */
    const haveData =
        !loading &&
        Boolean(data) &&
        _.has(data, 'artifacts.artifacts[0].states');
    useEffect(() => {
        if (!haveData) return;
        const state = _.find(
            /** this is a bit strange, that received data doesn't propage to original
             * artifact object. Original artifact.states objects stays old */
            _.get(data, 'artifacts.artifacts[0].states'),
            (state) => state.kai_state?.msg_id === msg_id,
        );
        if (_.isNil(state)) return;
        const xunitRaw: string = state.broker_msg_xunit;
        if (_.isEmpty(xunitRaw)) {
            setXunitProcessed(true);
            return;
        }
        try {
            /** Decode base64 encoded gzipped data */
            const compressed = Buffer.from(xunitRaw, 'base64');
            const decompressed = pako.inflate(compressed);
            const utf8Decoded = Buffer.from(decompressed).toString('utf8');
            setXunit(utf8Decoded);
        } catch (err) {
            const error = (
                <Alert isInline isPlain title="Xunit error">
                    Could not parse test results: {err}
                </Alert>
            );
            setError(error);
        }
        setXunitProcessed(true);
    }, [data, msg_id, haveData, artifact.states]);
    const inflating = data && !xunitProcessed;
    if (loading || inflating) {
        const text = loading ? 'Fetching test results…' : 'Inflating…';
        return (
            <>
                <Spinner size="md" />
                {text}
            </>
        );
    }
    if (msgError) return <>{msgError}</>;
    if (_.isEmpty(xunit)) {
        return <NoXunit />;
    }
    const parsedXunit = xunitParser(xunit);
    if (_.isEmpty(parsedXunit)) {
        return <NoXunit />;
    }
    /* TODO XXX: remove / generalize */
    if (
        parsedXunit[0].name === 'rpmdiff-analysis' ||
        parsedXunit[0].name === 'rpmdiff-comparison'
    ) {
        return (
            <div>
                {parsedXunit[0].properties['baseosci.overall-result']} -{' '}
                <a
                    href={parsedXunit[0].properties['baseosci.url.rpmdiff-run']}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    detailed results on RPMdiff Web UI
                </a>
            </div>
        );
    }
    return <Testsuites xunit={parsedXunit} />;
};

export const TestSuites = memo(
    TestSuites_,
    ({ state: state_prev }, { state: state_next }) =>
        _.isEqual(state_prev, state_next),
);
