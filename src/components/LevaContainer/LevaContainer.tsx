/* eslint-disable @typescript-eslint/no-unused-vars */
import { createPlugin, useInputContext, type LevaInputProps, Components } from 'leva/plugin';
import './LevaContainer.scss';
import clsx from 'clsx';
import { useState, type CSSProperties } from 'react';

const { Row, Label, String } = Components;

type ContainerSettings = {
  showLabel?: boolean;
  labelRow?: boolean;
  content?: React.ReactNode | ((props: { value: any; setValue: (v: any) => void }) => React.ReactNode);
  className?: string;
  style?: React.CSSProperties;
  contentWrapperClassName?: string;
  contentWrapperStyle?: React.CSSProperties;
  labelVerticalAlign?: 'top' | 'center';
  labelWidth?: 'auto' | number;
  contentWidth?: string;
};
type ContainerValueType = number;
type ContainerProps = { contentValue: ContainerValueType } & ContainerSettings;

type ContainerInputProps = LevaInputProps<ContainerValueType, ContainerSettings, string>;

function ContainerComponent() {
  const props = useInputContext<ContainerInputProps>();
  const { label, displayValue, onUpdate, onChange, settings, value } = props;

  return (
    <Row
      className={clsx(
        'leva-container',
        {
          ['leva-container--with-label']: settings.showLabel,
        },
        `leva-container--label-vertical-align-${settings.labelVerticalAlign}`,
        settings.className,
      )}
      style={
        {
          ...settings.style,
          '--label-width':
            typeof settings.labelWidth === 'number'
              ? `${settings.labelWidth}px`
              : settings.labelWidth,
          '--content-width': settings.contentWidth,
        } as CSSProperties
      }
      input={settings.showLabel && !settings.labelRow}
    >
      {settings.showLabel ? <Label>{label}</Label> : null}
      <div
        data-label={displayValue}
        className={settings.contentWrapperClassName}
        style={settings.contentWrapperStyle}
      >
        {typeof settings.content === 'function'
          ? settings.content?.({
            value,
            setValue: (v) => {
              onUpdate(v);
            },
          })
          : settings.content}
      </div>
    </Row>
  );
}

const normalize = ({ contentValue, ...settings }: ContainerProps) => {

  return {
    value: contentValue,
    settings: {
      showLabel: true,
      labelRow: false,
      labelVerticalAlign: 'top' as ContainerSettings['labelVerticalAlign'],
      content: null,
      labelWidth: 'auto' as ContainerSettings['labelWidth'],
      contentWidth: 'var(--leva-sizes-controlWidth)',
      ...settings,
    },
  };
};

const sanitize = (v: ContainerValueType, settings: ContainerSettings): ContainerValueType => {
  return v;
};

const format = (v: ContainerValueType) => {
  return v;
};

export const LevaContainer = createPlugin({
  sanitize,
  format,
  normalize,
  component: ContainerComponent,
});
