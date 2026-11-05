import './UiModeToggle.css'

// Switch between the two interfaces (like Hubtel's "switch to classic" toggle).
function UiModeToggle({ mode, onChange, tone = 'light' }) {
  const isClassic = mode === 'classic'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isClassic}
      className={`ui-toggle ui-toggle-${tone}${isClassic ? ' is-on' : ''}`}
      onClick={() => onChange(isClassic ? 'modern' : 'classic')}
      title={isClassic ? 'Switch to the new interface' : 'Switch to the classic interface'}
    >
      <span className="ui-toggle-label">Classic view</span>
      <span className="ui-toggle-track" aria-hidden="true"><span className="ui-toggle-knob" /></span>
    </button>
  )
}

export default UiModeToggle
