import { useEffect, useMemo, useRef, useState } from 'react'
import { SUGGESTED_PROMPTS, answerQuestion, buildCopilotContext } from '../../lib/copilot'
import './AiCopilot.css'

function Answer({ a }) {
  return (
    <div className="ai-answer">
      <h3>{a.title}</h3>
      <p className="ai-summary">{a.summary}</p>
      {a.kpis?.length ? (
        <div className="ai-kpis">
          {a.kpis.map(k => <div key={k.label} className={k.tone === 'bad' ? 'is-bad' : ''}><span>{k.label}</span><strong>{k.value}</strong></div>)}
        </div>
      ) : null}
      {a.table ? (
        <div className="ai-table-scroll">
          <table className="ai-table">
            <thead><tr>{a.table.columns.map((c, i) => <th key={c} className={i ? 'num' : ''}>{c}</th>)}</tr></thead>
            <tbody>{a.table.rows.map((r, idx) => <tr key={idx}>{r.map((c, i) => <td key={i} className={i ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : null}
      {a.bullets?.length ? <ul className="ai-bullets">{a.bullets.map(b => <li key={b}>{b}</li>)}</ul> : null}
    </div>
  )
}

function AiCopilot(props) {
  const ctx = useMemo(() => buildCopilotContext(props), [props])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  const ask = text => {
    const q = String(text || '').trim()
    if (!q) return
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'assistant', answer: answerQuestion(q, ctx) }])
    setDraft('')
  }
  const lastFollowups = [...messages].reverse().find(m => m.answer)?.answer.followups || SUGGESTED_PROMPTS

  return (
    <section className="ai-wrap" aria-label="AI Copilot">
      <div className="ai-intro">
        <span className="ai-spark" aria-hidden="true">✦</span>
        <div>
          <h2>Ask about your business</h2>
          <p>Answers are calculated instantly from your live sales, cash, stock and production records. Nothing is sent to an outside AI service.</p>
        </div>
      </div>

      <div className="ai-thread" aria-live="polite">
        {!messages.length ? (
          <div className="ai-empty">
            <p>Try one of these:</p>
            <div className="ai-chips">{SUGGESTED_PROMPTS.map(p => <button key={p} type="button" onClick={() => ask(p)}>{p}</button>)}</div>
          </div>
        ) : messages.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="ai-msg ai-msg-user"><p>{m.text}</p></div>
            : <div key={i} className="ai-msg ai-msg-bot"><Answer a={m.answer} /></div>
        ))}
        <div ref={endRef} />
      </div>

      {messages.length ? (
        <div className="ai-chips ai-chips-follow">
          {lastFollowups.map(p => <button key={p} type="button" onClick={() => ask(p)}>{p}</button>)}
          <button type="button" className="ai-clear" onClick={() => setMessages([])}>Clear chat</button>
        </div>
      ) : null}

      <form className="ai-input" onSubmit={e => { e.preventDefault(); ask(draft) }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="e.g. Who owes us the most money?" aria-label="Ask a question" />
        <button type="submit" disabled={!draft.trim()}>Ask</button>
      </form>
    </section>
  )
}

export default AiCopilot
