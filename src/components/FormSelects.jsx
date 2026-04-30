import { Autocomplete, ListBox, Select } from '@heroui/react'

function normalizeSelectedKey(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function renderOption(option) {
  return (
    <ListBox.Item id={option.value} textValue={option.searchText || option.label}>
      <div className="app-select-option">
        <span>{option.label}</span>
        {option.meta ? <small>{option.meta}</small> : null}
      </div>
    </ListBox.Item>
  )
}

export function AppSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  ariaLabel,
  isDisabled = false,
  isRequired = false,
  className = '',
}) {
  return (
    <Select
      aria-label={ariaLabel || placeholder}
      className={`app-form-select ${className}`.trim()}
      fullWidth
      isDisabled={isDisabled}
      isRequired={isRequired}
      items={options}
      placeholder={placeholder}
      selectedKey={normalizeSelectedKey(value)}
      variant="secondary"
      onChange={key => onChange?.(key == null ? '' : String(key))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox items={options}>
          {renderOption}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export function AppAutocomplete({
  value,
  onChange,
  options = [],
  placeholder = 'Search and select',
  searchPlaceholder = 'Search...',
  ariaLabel,
  isDisabled = false,
  isRequired = false,
  className = '',
}) {
  return (
    <Autocomplete
      aria-label={ariaLabel || placeholder}
      className={`app-form-select ${className}`.trim()}
      fullWidth
      isDisabled={isDisabled}
      isRequired={isRequired}
      items={options}
      placeholder={placeholder}
      selectedKey={normalizeSelectedKey(value)}
      variant="secondary"
      onChange={key => onChange?.(key == null ? '' : String(key))}
      onClear={() => onChange?.('')}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter placeholder={searchPlaceholder} />
        <ListBox items={options}>
          {renderOption}
        </ListBox>
      </Autocomplete.Popover>
    </Autocomplete>
  )
}
