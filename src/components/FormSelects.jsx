import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './FormSelects.css'

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function getOptionByValue(options, value) {
  return options.find(option => String(option.value) === String(value ?? ''))
}

function Chevron() {
  return (
    <svg className="app-dd-chevron" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.5 7.75 10 12.25l4.5-4.5" />
    </svg>
  )
}

function Check() {
  return (
    <svg className="app-dd-check" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4.75 10.5 8.25 14l7-8" />
    </svg>
  )
}

// Menu is rendered in a portal with fixed positioning so modals never clip it;
// it opens upwards when there is not enough room below the field.
function useMenuPosition(open, anchorRef) {
  const [style, setStyle] = useState(null)
  useLayoutEffect(() => {
    if (!open) return undefined
    const place = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const up = below < 220 && above > below
      const maxHeight = Math.max(160, Math.min(320, up ? above : below))
      setStyle({
        position: 'fixed',
        left: Math.round(r.left),
        width: Math.round(Math.max(r.width, 180)),
        maxHeight,
        ...(up ? { bottom: Math.round(window.innerHeight - r.top + 6) } : { top: Math.round(r.bottom + 6) }),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef])
  return style
}

function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  searchPlaceholder,
  ariaLabel,
  isDisabled = false,
  isRequired = false,
  className = '',
  variant = 'default',
  searchable = false,
  clearable = false,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const selected = getOptionByValue(options, value)
  const menuStyle = useMenuPosition(open, rootRef)

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    if (!searchable || !q) return options
    return options.filter(o => [o.label, o.meta, o.searchText, o.value].some(c => normalizeText(c).includes(q)))
  }, [options, query, searchable])

  // Close on outside press.
  useEffect(() => {
    if (!open) return undefined
    const onDown = e => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open || active < 0) return
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const openMenu = () => {
    if (isDisabled) return
    setQuery('')
    const idx = options.findIndex(o => String(o.value) === String(value ?? ''))
    setActive(idx >= 0 ? idx : 0)
    setOpen(true)
  }
  const choose = option => {
    onChange?.(option ? String(option.value) : '')
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = e => {
    if (isDisabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !(searchable && e.key === ' ')) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
    else if (!searchable && e.key.length === 1) {
      // Type-ahead: jump to the first option starting with the key.
      const idx = filtered.findIndex(o => normalizeText(o.label).startsWith(e.key.toLowerCase()))
      if (idx >= 0) setActive(idx)
    }
  }

  const activeId = open && active >= 0 ? `${listId}-opt-${active}` : undefined
  const comboProps = {
    role: 'combobox',
    'aria-expanded': open,
    'aria-controls': listId,
    'aria-haspopup': 'listbox',
    'aria-activedescendant': activeId,
    'aria-label': ariaLabel || placeholder,
    'aria-required': isRequired || undefined,
    onKeyDown,
  }

  return (
    <div
      ref={rootRef}
      className={`app-dd app-dd-${variant}${open ? ' is-open' : ''}${isDisabled ? ' is-disabled' : ''} ${className}`.trim()}
    >
      {searchable ? (
        <input
          ref={inputRef}
          {...comboProps}
          type="text"
          className="app-dd-trigger app-dd-input"
          disabled={isDisabled}
          autoComplete="off"
          placeholder={selected ? selected.label : (searchPlaceholder || placeholder)}
          value={open ? query : (selected?.label || '')}
          onFocus={() => { if (!open) openMenu() }}
          onClick={() => { if (!open) openMenu() }}
          onChange={e => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true) }}
        />
      ) : (
        <button
          type="button"
          {...comboProps}
          className="app-dd-trigger"
          disabled={isDisabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          <span className={`app-dd-value${selected ? '' : ' is-placeholder'}`}>{selected?.label || placeholder}</span>
        </button>
      )}
      {clearable && selected && !isDisabled ? (
        <button
          type="button"
          className="app-dd-clear"
          aria-label={`Clear ${ariaLabel || placeholder}`}
          onClick={() => { choose(null); inputRef.current?.focus() }}
        >
          ×
        </button>
      ) : null}
      <Chevron />
      {/* Keeps native "required" validation working on submit. */}
      {isRequired ? (
        <input
          className="app-dd-proxy"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={selected ? String(selected.value) : ''}
          onChange={() => {}}
          onFocus={() => (searchable ? inputRef.current : rootRef.current?.querySelector('button'))?.focus()}
        />
      ) : null}
      {open && menuStyle ? createPortal(
        <ul ref={menuRef} id={listId} role="listbox" className="app-dd-menu" style={menuStyle} aria-label={ariaLabel || placeholder}>
          {filtered.length ? filtered.map((o, i) => {
            const isSelected = String(o.value) === String(value ?? '')
            return (
              <li
                key={o.value}
                id={`${listId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                className={`app-dd-option${i === active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                onPointerDown={e => e.preventDefault()}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(o)}
              >
                <span className="app-dd-option-text">
                  <span className="app-dd-option-label">{o.label}</span>
                  {o.meta ? <small>{o.meta}</small> : null}
                </span>
                {isSelected ? <Check /> : null}
              </li>
            )
          }) : <li className="app-dd-empty">No matches{query ? ` for “${query}”` : ''}</li>}
        </ul>,
        document.body,
      ) : null}
    </div>
  )
}

export function AppFilterPicker({ value, onChange, options = [], placeholder = 'Select', ariaLabel, isDisabled = false, className = '' }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={[{ value: '', label: placeholder }, ...options]}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      isDisabled={isDisabled}
      className={`app-filter-select ${className}`.trim()}
      variant="filter"
    />
  )
}

export function AppSelect({ value, onChange, options = [], placeholder = 'Select', ariaLabel, isDisabled = false, isRequired = false, className = '' }) {
  return (
    <Dropdown
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

export function AppAutocomplete({ value, onChange, options = [], placeholder = 'Search and select', searchPlaceholder, ariaLabel, isDisabled = false, isRequired = false, className = '' }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      ariaLabel={ariaLabel}
      isDisabled={isDisabled}
      isRequired={isRequired}
      className={`app-form-select ${className}`.trim()}
      searchable
      clearable={!isRequired}
    />
  )
}
