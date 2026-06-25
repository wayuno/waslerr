import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import { ChatIconBubble, CloseIcon, SendIcon } from './icons'

export default function ChatWidget() {
  const { chatOpen, setChatOpen, chatMsgs, sendUserChat } = useStore()
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [chatMsgs, chatOpen])

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    sendUserChat(text)
    setText('')
  }

  return (
    <>
      {chatOpen && (
        <div className="wf-chat-panel" role="dialog" aria-label="Waslerr support">
          <div className="wf-chat-header">
            <div>
              <span className="wf-chat-title">
                <span className="wf-online" /> Waslerr support
              </span>
              <span className="wf-chat-meta">Typically replies in minutes</span>
            </div>
            <button className="wf-chat-close" aria-label="Close chat" onClick={() => setChatOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <div className="wf-chat-list" ref={listRef}>
            {chatMsgs.map((m, i) => (
              <div key={i} className={`wf-msg wf-msg--${m.from}`}>
                {m.from === 'admin' && <span className="wf-msg-who">Waslerr</span>}
                {m.text}
              </div>
            ))}
          </div>
          <form className="wf-chat-input" onSubmit={submit}>
            <input
              className="wf-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask about a field…"
            />
            <button className="wf-chat-send" type="submit" aria-label="Send message">
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      <button
        className={`wf-fab${chatOpen ? ' open' : ''}`}
        aria-label={chatOpen ? 'Close support chat' : 'Open support chat'}
        onClick={() => setChatOpen(!chatOpen)}
      >
        {!chatOpen && <span className="wf-fab-ring" aria-hidden="true" />}
        {chatOpen ? <CloseIcon size={20} /> : <ChatIconBubble />}
      </button>
    </>
  )
}
