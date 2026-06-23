import { useEffect, useState } from 'react'
import LibraryGate from './LibraryGate'

function App() {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    window.api.getVersion().then(setVersion).catch((e) => setVersion(`error: ${e}`))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ margin: '0 0 16px' }}>IMGMAN</h1>
      <LibraryGate />
      <footer style={{ marginTop: 32, color: '#bbb', fontSize: 12 }}>
        IMGMAN v{version}
      </footer>
    </main>
  )
}

export default App
