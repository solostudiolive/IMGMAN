import LibraryGate from './LibraryGate'
import TitleBar from './components/TitleBar'

function App(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'var(--font-sans)',
        background: 'var(--color-bg-app)',
        color: 'var(--color-text)',
        lineHeight: 'var(--lh)'
      }}
    >
      <TitleBar />
      {/* LibraryGate fills the area under the title bar: the three-pane shell when a
          library is open, or a centered welcome screen when none is. */}
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <LibraryGate />
      </div>
    </div>
  )
}

export default App
