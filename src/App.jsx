import { useEffect, useState } from 'react'
import { AudioProvider } from './audio/AudioProvider'
import { StoreProvider, useStore } from './store/StoreProvider'
import Nav from './components/Nav'
import ChatWidget from './components/ChatWidget'
import Toast from './components/Toast'
import Home from './pages/Home'
import Fields from './pages/Fields'
import Method from './pages/Method'
import Community from './pages/Community'
import Detail from './screens/Detail'
import Checkout from './screens/Checkout'
import Login from './screens/Login'
import Admin from './screens/Admin'
import Updates from './screens/Updates'
import Reviews from './screens/Reviews'

function Shell() {
  const { page, navigate, fieldsCat } = useStore()

  // intro overlay — plays once on first load
  const [introLift, setIntroLift] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setIntroLift(true), 2000)
    const t2 = setTimeout(() => setIntroDone(true), 3050)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <>
      {!introDone && (
        <div className={`wf-intro${introLift ? ' lift' : ''}`}>
          <span className="wf-intro-logo">W</span>
          <span className="wf-intro-word">WASLERR&nbsp;FIELDS</span>
          <span className="wf-intro-bar">
            <span />
          </span>
        </div>
      )}

      <Nav />

      {page === 'home' && <Home onNavigate={navigate} />}
      {page === 'fields' && <Fields key={`fields-${fieldsCat}`} onNavigate={navigate} initialCat={fieldsCat} />}
      {page === 'method' && <Method onNavigate={navigate} />}
      {page === 'community' && <Community onNavigate={navigate} />}
      {page === 'detail' && <Detail />}
      {page === 'checkout' && <Checkout />}
      {page === 'login' && <Login />}
      {page === 'admin' && <Admin />}
      {page === 'updates' && <Updates />}
      {page === 'reviews' && <Reviews />}

      <ChatWidget />
      <Toast />
    </>
  )
}

export default function App() {
  return (
    <AudioProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </AudioProvider>
  )
}
