import * as RSlider from '@radix-ui/react-slider';
import * as RSwitch from '@radix-ui/react-switch';
import * as RTabs from '@radix-ui/react-tabs';
import { useId, type ReactNode } from 'react';

/**
 * Headless field primitives for reader chrome. Behaviour comes from Radix;
 * styling is the consumer's — every element carries a `data-pore-*` hook and
 * accepts `className`. Class names mirror the pre-Radix markup so existing
 * stylesheets keep working.
 */

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = 'pore-settings__row',
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const Tag = htmlFor ? 'div' : 'label';
  return (
    <Tag className={className} data-pore-field {...(htmlFor ? {} : {})}>
      <span data-pore-field-label>
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        {hint ? <small data-pore-field-hint> {hint}</small> : null}
      </span>
      {children}
    </Tag>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onValueChange,
  options,
  disabled,
  className,
}: {
  label: ReactNode;
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className ?? 'pore-settings__row'}>
      <select
        id={id}
        data-pore-select
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SliderField({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  format,
  className,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const id = useId();
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={format ? format(value) : String(value)}
      className={className ?? 'pore-settings__row'}
    >
      <RSlider.Root
        id={id}
        data-pore-slider
        className="pore-slider"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => v !== undefined && onValueChange(v)}
        aria-label={label}
      >
        <RSlider.Track data-pore-slider-track className="pore-slider__track">
          <RSlider.Range data-pore-slider-range className="pore-slider__range" />
        </RSlider.Track>
        <RSlider.Thumb data-pore-slider-thumb className="pore-slider__thumb" />
      </RSlider.Root>
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className ?? 'pore-settings__row'}>
      <RSwitch.Root
        id={id}
        data-pore-switch
        className="pore-switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
      >
        <RSwitch.Thumb data-pore-switch-thumb className="pore-switch__thumb" />
      </RSwitch.Root>
    </Field>
  );
}

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  tabs,
  value,
  onValueChange,
  trailing,
  className = 'pore-tabs',
}: {
  tabs: TabDef[];
  value: string;
  onValueChange: (id: string) => void;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className} data-pore-tabs>
      {/* `trailing` (a close button) sits alongside the tablist, not inside it —
          ARIA's `tablist` role only permits `tab` children. */}
      <div className="pore-settings__tabsrow">
        <RTabs.List className="pore-settings__tabs" data-pore-tablist>
          {tabs.map((t) => (
            <RTabs.Trigger
              key={t.id}
              value={t.id}
              data-pore-tab
              className={value === t.id ? 'active' : ''}
            >
              {t.label}
            </RTabs.Trigger>
          ))}
        </RTabs.List>
        {trailing}
      </div>
      {tabs.map((t) => (
        <RTabs.Content
          key={t.id}
          value={t.id}
          className="pore-settings__body"
          data-pore-tabpanel
        >
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
