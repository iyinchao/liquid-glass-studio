import { Components, createPlugin, useInputContext, type LevaInputProps } from 'leva/plugin';
import './LevaShortcutBoolean.scss';

const { Row, Label, Boolean: Checkbox } = Components;

type ShortcutSettings = { shortcut: string; shortcutLabel: string };
type ShortcutInput = ShortcutSettings & { checked: boolean };

function ShortcutBoolean() {
  const { id, label, value, onUpdate, disabled, settings } =
    useInputContext<LevaInputProps<boolean, ShortcutSettings, boolean>>();

  return (
    <Row input>
      <Label>{label}</Label>
      <div className="leva-shortcut-boolean">
        <Checkbox id={id} value={value} onUpdate={onUpdate} disabled={disabled} />
        <kbd title={settings.shortcutLabel} aria-label={settings.shortcutLabel}>
          <span>{settings.shortcut}</span>
        </kbd>
      </div>
    </Row>
  );
}

export const LevaShortcutBoolean = createPlugin({
  component: ShortcutBoolean,
  normalize: ({ checked, ...settings }: ShortcutInput) => ({ value: checked, settings }),
  sanitize: (value: boolean) => value,
  format: (value: boolean) => value,
});
