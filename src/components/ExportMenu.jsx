import { useEffect, useRef, useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import './ExportMenu.css'

// One export button for the whole app: PDF on the Plus Treat letterhead, or Excel.
// onExport receives 'pdf' or 'xlsx'.
function ExportMenu({ onExport, label = 'Export', align = 'right', className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = e => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = format => {
    setOpen(false)
    onExport?.(format)
  }

  return (
    <div ref={rootRef} className={`xm ${className}`.trim()}>
      <button
        type="button"
        className="mc-ghost-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <FiDownload aria-hidden="true" /> {label}
      </button>
      {open ? (
        <div className={`xm-menu xm-menu-${align}`} role="menu">
          <button type="button" role="menuitem" onClick={() => pick('pdf')}>
            <span className="xm-tag xm-tag-pdf" aria-hidden="true">PDF</span>
            <span className="xm-copy"><strong>PDF document</strong><em>Plus Treat letterhead, ready to print</em></span>
          </button>
          <button type="button" role="menuitem" onClick={() => pick('xlsx')}>
            <span className="xm-tag xm-tag-xls" aria-hidden="true">XLS</span>
            <span className="xm-copy"><strong>Excel spreadsheet</strong><em>For editing and sums</em></span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ExportMenu
