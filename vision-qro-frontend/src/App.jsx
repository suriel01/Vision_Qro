import InteractiveMap from './components/map/InteractiveMap';

function App() {
  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <InteractiveMap />
    </div>
  );
}

export default App;