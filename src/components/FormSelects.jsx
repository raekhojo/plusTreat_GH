import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

function useIsMobilePicker(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= breakpoint
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [breakpoint])

  return isMobile
}

function MobileSelectModal({
  open,
  title,
  placeholder,
  searchPlaceholder,
  options,
  value,
  onChange,
  onClose,
  allowClear = false,
}) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) => {
      const haystack = [
        option.label,
        option.meta,
        option.searchText,
        option.value,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [options, search])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="mobile-select-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <article
        className="mobile-select-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title || placeholder}
      >
        <div className="mobile-select-modal-handle" aria-hidden="true" />
        <div className="mobile-select-modal-header">
          <div>
            <h3>{title || placeholder}</h3>
          </div>
          <button type="button" className="mobile-select-modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="mobile-select-modal-search">
          <span>Search</span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </label>

        {allowClear && value ? (
          <button
            type="button"
            className="mobile-select-modal-clear"
            onClick={() => {
              onChange?.('')
              onClose?.()
            }}
          >
            Clear selection
          </button>
        ) : null}

        <div className="mobile-select-modal-options">
          {filteredOptions.length ? (
            filteredOptions.map((option) => {
              const isSelected = String(option.value) === String(value || '')
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`mobile-select-modal-option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange?.(String(option.value))
                    onClose?.()
                  }}
                >
                  <span className="mobile-select-modal-option-label">{option.label}</span>
                  {option.meta ? <small>{option.meta}</small> : null}
                </button>
              )
            })
          ) : (
            <p className="mobile-select-modal-empty">No matching options found.</p>
          )}
        </div>
      </article>
    </div>,
    document.body,
  )
}

function MobileSelectField({
  value,
  onChange,
  options = [],
  placeholder,
  searchPlaceholder,
  ariaLabel,
  isDisabled = false,
  isRequired = false,
  className = '',
  allowClear = false,
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => String(option.value) === String(value || ''))

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel || placeholder}
        className={`mobile-select-trigger ${className}`.trim()}
        disabled={isDisabled}
        onClick={() => setOpen(true)}
      >
        <span className={`mobile-select-trigger-value${selectedOption ? ' has-value' : ''}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="mobile-select-trigger-icon" aria-hidden="true">
          ▾
        </span>
      </button>
      {!isRequired && allowClear && value ? (
        <button
          type="button"
          className="mobile-select-inline-clear"
          onClick={() => onChange?.('')}
        >
          Clear
        </button>
      ) : null}
      <MobileSelectModal
        open={open}
        title={ariaLabel || placeholder}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        options={options}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
        allowClear={!isRequired && allowClear}
      />
    </>
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
  const isMobile = useIsMobilePicker()

  if (isMobile) {
    return (
      <MobileSelectField
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={`Search ${String(placeholder || 'options').toLowerCase()}...`}
        ariaLabel={ariaLabel}
        isDisabled={isDisabled}
        isRequired={isRequired}
        className={className}
      />
    )
  }

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
      onSelectionChange={key => onChange?.(key == null ? '' : String(key))}
    >
      <Select.Trigger />
      <Select.Value />
      <Select.Indicator />
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
  const isMobile = useIsMobilePicker()

  if (isMobile) {
    return (
      <MobileSelectField
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        ariaLabel={ariaLabel}
        isDisabled={isDisabled}
        isRequired={isRequired}
        className={className}
        allowClear
      />
    )
  }

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
      onSelectionChange={key => onChange?.(key == null ? '' : String(key))}
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
