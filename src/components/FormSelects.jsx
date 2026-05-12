import { useEffect, useId, useMemo, useState } from 'react'

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function getOptionByValue(options, value) {
  return options.find(option => String(option.value) === String(value || ''))
}

function getOptionByDisplay(options, text) {
  const normalized = normalizeText(text)
  if (!normalized) return null
  return options.find((option) => {
    const candidates = [
      option.label,
      option.value,
      option.searchText,
      option.meta,
    ]
    return candidates.some(candidate => normalizeText(candidate) === normalized)
  }) || null
}

function getAutocompleteDisplayValue(options, value) {
  const selectedOption = getOptionByValue(options, value)
  return selectedOption?.label || String(value || '')
}

function NativeSelectField({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  ariaLabel,
  isDisabled = false,
  isRequired = false,
  className = '',
  variant = 'default',
}) {
  return (
    <div className={`app-native-field app-native-field-select app-native-field-${variant} ${className}`.trim()}>
      <select
        aria-label={ariaLabel || placeholder}
        className="app-native-control app-native-control-select"
        disabled={isDisabled}
        required={isRequired}
        value={value ?? ''}
        onChange={event => onChange?.(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="app-native-field-icon" aria-hidden="true">▼</span>
    </div>
  )
}

export function AppFilterPicker({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  ariaLabel,
  isDisabled = false,
  className = '',
}) {
  return (
    <NativeSelectField
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      isDisabled={isDisabled}
      className={`app-filter-select ${className}`.trim()}
      variant="filter"
    />
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
    <NativeSelectField
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      isDisabled={isDisabled}
      isRequired={isRequired}
      className={`app-form-select ${className}`.trim()}
    />
  )
}

export function AppAutocomplete({
  value,
  onChange,
  options = [],
  placeholder = 'Search and select',
  searchPlaceholder,
  ariaLabel,
  isDisabled = false,
  isRequired = false,
  className = '',
}) {
  const listId = useId()
  const optionLookup = useMemo(() => new Map(
    options.map(option => [normalizeText(option.label), String(option.value)]),
  ), [options])
  const [draft, setDraft] = useState(() => getAutocompleteDisplayValue(options, value))

  useEffect(() => {
    setDraft(getAutocompleteDisplayValue(options, value))
  }, [options, value])

  function handleChange(nextDraft) {
    setDraft(nextDraft)

    if (!nextDraft) {
      onChange?.('')
      return
    }

    const matchedValue = optionLookup.get(normalizeText(nextDraft))
    if (matchedValue !== undefined) {
      onChange?.(matchedValue)
      return
    }

    const matchedOption = getOptionByDisplay(options, nextDraft)
    onChange?.(matchedOption ? String(matchedOption.value) : nextDraft)
  }

  return (
    <div className={`app-native-field app-native-field-autocomplete app-form-select ${className}`.trim()}>
      <input
        aria-label={ariaLabel || placeholder}
        className="app-native-control app-native-control-input"
        disabled={isDisabled}
        list={listId}
        placeholder={searchPlaceholder || placeholder}
        required={isRequired}
        value={draft}
        onChange={event => handleChange(event.target.value)}
      />
      {draft && !isRequired ? (
        <button
          type="button"
          className="app-native-field-clear"
          aria-label={`Clear ${ariaLabel || placeholder}`}
          onClick={() => handleChange('')}
        >
          ×
        </button>
      ) : null}
      <span className="app-native-field-icon" aria-hidden="true">▼</span>
      <datalist id={listId}>
        {options.map(option => (
          <option
            key={option.value}
            value={option.label}
            label={option.meta ? `${option.label} - ${option.meta}` : option.label}
          />
        ))}
      </datalist>
    </div>
  )
}
