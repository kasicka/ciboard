/*
 * This file is part of ciboard

 * Copyright (c) 2021, 2022 Andrei Stepanov <astepano@redhat.com>
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
import moment from 'moment';
import classNames from 'classnames';
import { useDispatch } from 'react-redux';
import {
    Flex,
    Text,
    Label,
    Title,
    Button,
    FlexItem,
    TitleSizes,
    LabelProps,
    TextContent,
    DataListCell,
    DataListItem,
    DataListToggle,
    DataListItemRow,
    DataListContent,
    DescriptionList,
    DataListItemCells,
    DescriptionListTerm,
    DescriptionListGroup,
    DescriptionListDescription,
} from '@patternfly/react-core';

import Linkify from 'react-linkify';

import {
    ArrowIcon,
    WeeblyIcon,
    RebootingIcon,
    RegisteredIcon,
    OutlinedThumbsUpIcon,
} from '@patternfly/react-icons';

import styles from '../custom.module.css';
import { renderStatusIcon } from '../utils/artifactUtils';
import { ArtifactType, StateGreenwaveType } from '../artifact';
import { ArtifactStateProps } from './ArtifactState';
import {
    mkPairs,
    mkLabel,
    StateLink,
    LinkifyNewTab,
    StateDetailsEntry,
} from './ArtifactState';

const timestampForUser = (inp: string, fromNow = false): string => {
    const time = moment.utc(inp).local().format('YYYY-MM-DD HH:mm Z');
    if (!fromNow) {
        return time;
    }
    const passed = moment.utc(inp).local().fromNow();
    const ret = time + ' (' + passed + ')';
    return ret;
};

interface WaiveButtonProps {
    state: StateGreenwaveType;
}
const WaiveButton: React.FC<WaiveButtonProps> = (props) => {
    const { state } = props;
    const { requirement } = state;
    const dispatch = useDispatch();
    if (_.isNil(requirement?.testcase)) {
        return null;
    }
    const onClick: React.MouseEventHandler = (e) => {
        e.stopPropagation();
        // XXX dispatch(createWaiver(artifact, broker_msg_body));
    };
    return (
        <Button key="waived" variant="secondary" onClick={onClick}>
            <OutlinedThumbsUpIcon />
            <span className={styles.waive}>waive</span>
        </Button>
    );
};

interface ReTestButtonProps {
    state: StateGreenwaveType;
}
const ReTestButton: React.FC<ReTestButtonProps> = (props) => {
    const { state } = props;
    const { result } = state;
    const rebuildUrl: string | undefined = _.get(result, 'data.rebuild[0]');
    if (_.isNil(rebuildUrl)) {
        return null;
    }
    return (
        <a
            href={rebuildUrl}
            key={result?.testcase.name}
            target="_blank"
            title="Rerun testing. Note login to the linked system might be required."
            rel="noopener noreferrer"
        >
            <Button
                variant="secondary"
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <RebootingIcon />
                <span className={styles.waive}>rerun</span>
            </Button>
        </a>
    );
};

interface StateActionsProps {
    state: StateGreenwaveType;
}
export const GreenwaveStateActions: React.FC<StateActionsProps> = (props) => {
    const { state } = props;
    const { requirement } = state;
    var hideWidget = true;
    if (!_.isNil(requirement?.testcase)) {
        hideWidget = false;
    }
    const rebuildUrl: string | undefined = _.get(
        state.result,
        'data.rebuild[0]',
    );
    if (!_.isNil(rebuildUrl)) {
        hideWidget = false;
    }
    if (hideWidget) {
        return null;
    }
    return (
        <StateDetailsEntry caption="Actions">
            <Flex>
                <FlexItem>
                    <WaiveButton state={state} />
                </FlexItem>
                <FlexItem>
                    <ReTestButton state={state} />
                </FlexItem>
            </Flex>
        </StateDetailsEntry>
    );
};

const resultMapping = [
    ['submit_time', 'submited', _.partialRight(timestampForUser, true)],
    ['id', 'result id'],
    ['href', 'resultsdb url'],
    ['note', 'note'],
    ['outcome', 'outcome'],
    /**
     * based on internal resultdb logic
     * https://github.com/release-engineering/resultsdb-updater/pull/131
     * https://issues.redhat.com/browse/RHELWF-5987
     */
    ['testcase.ref_url', 'testcase info'],
];

interface GreenwaveResultProps {
    state: StateGreenwaveType;
}
export const GreenwaveResult: React.FC<GreenwaveResultProps> = (props) => {
    const { state } = props;
    if (!state.result) {
        return null;
    }
    const pairs = mkPairs(resultMapping, state.result);
    if (_.isEmpty(pairs)) {
        return null;
    }
    const elements: Array<JSX.Element> = _.map(pairs, ([name, value]) =>
        mkLabel(name, value, 'orange'),
    );
    return (
        <StateDetailsEntry caption="Result info">
            <DescriptionList
                isCompact
                isHorizontal
                columnModifier={{
                    default: '2Col',
                }}
            >
                {elements}
            </DescriptionList>
        </StateDetailsEntry>
    );
};

const waiverMapping = [
    ['comment', 'comment'],
    ['id', 'id'],
    ['scenario', 'scenario'],
    ['timestamp', 'time', _.partialRight(timestampForUser, true)],
    ['username', 'username'],
    ['waived', 'waived'],
];

interface GreenwaveWaiverProps {
    state: StateGreenwaveType;
}
export const GreenwaveWaiver: React.FC<GreenwaveWaiverProps> = (props) => {
    const { state } = props;
    if (!state.waiver) {
        return null;
    }
    const pairs = mkPairs(waiverMapping, state.waiver);
    if (_.isEmpty(pairs)) {
        return null;
    }
    const elements: Array<JSX.Element> = _.map(pairs, ([name, value]) =>
        mkLabel(name, value, 'red'),
    );
    return (
        <StateDetailsEntry caption="Waiver info">
            <DescriptionList
                isCompact
                isHorizontal
                columnModifier={{
                    default: '2Col',
                }}
            >
                {elements}
            </DescriptionList>
        </StateDetailsEntry>
    );
};

const reqMapping = [
    ['requirement.scenario', 'scenario'],
    ['requirement.source', 'source'],
    ['requirement.error_reason', 'error reason'],
];

interface GreenwaveRequirementProps {
    state: StateGreenwaveType;
}
export const GreenwaveRequirement: React.FC<GreenwaveRequirementProps> = (
    props,
) => {
    const { state } = props;
    const pairs = mkPairs(waiverMapping, state);
    if (_.isEmpty(pairs)) {
        return null;
    }
    const elements: Array<JSX.Element> = _.map(pairs, ([name, value]) =>
        mkLabel(name, value, 'blue'),
    );
    return (
        <StateDetailsEntry caption="Requirement info">
            <DescriptionList
                isCompact
                isHorizontal
                columnModifier={{
                    default: '2Col',
                }}
            >
                {elements}
            </DescriptionList>
        </StateDetailsEntry>
    );
};

interface GreenwaveResultDataProps {
    state: StateGreenwaveType;
}
export const GreenwaveResultData: React.FC<GreenwaveResultDataProps> = (
    props,
) => {
    const { state } = props;
    const { result } = state;
    if (_.isUndefined(result) || !_.isObject(result?.data)) {
        return null;
    }
    const mkItem = (
        name: string,
        values: Array<string>,
    ): JSX.Element | null => {
        const valuesRendered: Array<JSX.Element | string> = _.map(
            values,
            (v) => {
                return <LinkifyNewTab>{v}</LinkifyNewTab>;
            },
        );
        return (
            <DescriptionListGroup>
                <DescriptionListTerm>{name}</DescriptionListTerm>
                <DescriptionListDescription>
                    <Label
                        isCompact
                        color="cyan"
                        icon={null}
                        variant="filled"
                        isTruncated
                    >
                        {valuesRendered}
                    </Label>
                </DescriptionListDescription>
            </DescriptionListGroup>
        );
    };
    const items: Array<JSX.Element | null> = [];
    /* result.data is array */
    _.map(result.data, (values, k) => {
        const item = mkItem(k, values);
        items.push(item);
    });
    _.remove(items, _.flow(_.identity, _.isNil));
    if (_.isEmpty(items)) {
        return null;
    }
    return (
        <StateDetailsEntry caption="Result data">
            <DescriptionList
                isCompact
                isHorizontal
                columnModifier={{
                    default: '2Col',
                }}
            >
                {items}
            </DescriptionList>
        </StateDetailsEntry>
    );
};

interface FaceForGreenwaveStateProps {
    state: StateGreenwaveType;
    artifact: ArtifactType;
    artifactDashboardUrl: string;
}

export const FaceForGreenwaveState: React.FC<FaceForGreenwaveStateProps> = (
    props,
) => {
    const { state, artifact, artifactDashboardUrl } = props;
    const { waiver, requirement, result } = state;
    const isWaived = _.isNumber(waiver?.id);
    const isGatingResult = _.isString(state.requirement?.testcase);
    var badgeClasses = classNames({
        [styles.isHidden]: !isGatingResult,
    });
    const labels: Array<JSX.Element> = [];
    labels.push(
        <Label
            color="blue"
            isCompact
            key="required"
            className={badgeClasses}
            icon={<RegisteredIcon />}
        >
            required for gating
        </Label>,
    );
    badgeClasses = classNames(styles.isRedBG, {
        [styles.isHidden]: !isWaived,
    });
    labels.push(
        <Label
            color="red"
            isCompact
            key="waived"
            className={badgeClasses}
            icon={<WeeblyIcon />}
        >
            waived
        </Label>,
    );
    const iconName = _.get(
        state,
        'requirement.type',
        _.get(state, 'result.outcome', 'unknown'),
    );
    const element = (
        <Flex style={{ minHeight: '34px' }}>
            <FlexItem>{renderStatusIcon(iconName)}</FlexItem>
            <Flex flexWrap={{ default: 'nowrap' }}>
                <TextContent>
                    <Text>{state.testcase}</Text>
                </TextContent>
            </Flex>
            <Flex>
                <FlexItem align={{ default: 'alignLeft' }}>{labels}</FlexItem>
            </Flex>
            <Flex align={{ default: 'alignRight' }}>
                <StateLink
                    state={state}
                    artifactDashboardUrl={artifactDashboardUrl}
                />
            </Flex>
        </Flex>
    );
    return element;
};

export interface ArtifactGreenwaveStateProps extends ArtifactStateProps {
    state: StateGreenwaveType;
}

export const ArtifactGreenwaveState: React.FC<ArtifactGreenwaveStateProps> = (
    props,
) => {
    const {
        state,
        artifact,
        stateName,
        forceExpand,
        setExpandedResult,
        artifactDashboardUrl,
    } = props;

    const { requirement, result, waiver } = state;
    /*
     * Expand a specific testcase according to query string and scroll to it
     * ?focus=tc:<test-case-name> or ?focus=id:<pipeline-id>
     */
    const onToggle = () => {
        if (!forceExpand) {
            const key = state.testcase;
            setExpandedResult(key);
        } else if (forceExpand) {
            setExpandedResult('');
        }
    };
    /** Note for info test results */
    let resultClasses = classNames(styles['helpSelect'], {
        [styles.expandedResult]: forceExpand,
    });
    const key = state.testcase;
    const toRender = (
        <DataListItem
            key={key}
            isExpanded={forceExpand}
            className={resultClasses}
            aria-labelledby="artifact-item-result"
        >
            <DataListItemRow>
                <DataListToggle
                    id="toggle"
                    onClick={onToggle}
                    isExpanded={forceExpand}
                />
                <DataListItemCells
                    className="pf-u-m-0 pf-u-p-0"
                    dataListCells={[
                        <DataListCell
                            className="pf-u-m-0 pf-u-p-0"
                            key="secondary content"
                        >
                            <FaceForGreenwaveState
                                state={state}
                                artifact={artifact}
                                artifactDashboardUrl={artifactDashboardUrl}
                            />
                        </DataListCell>,
                    ]}
                />
            </DataListItemRow>
            <DataListContent
                aria-label="Primary Content Result Details"
                id="ex-result-expand1"
                isHidden={!forceExpand}
            >
                {forceExpand && (
                    <>
                        <GreenwaveStateActions state={state} />
                        <GreenwaveResult state={state} />
                        <GreenwaveWaiver state={state} />
                        <GreenwaveResultData state={state} />
                        <GreenwaveRequirement state={state} />
                    </>
                )}
            </DataListContent>
        </DataListItem>
    );

    return toRender;
};