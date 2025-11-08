import { LiquidGlass } from './components/LiquidGlass/LiquidGlass';
import styles from './App.module.scss';

function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Liquid Glass React</h1>
        <p>Wrap any component with the liquid glass effect</p>
      </header>

      <div className={styles.demos}>
        <div className={styles.demo}>
          <h2>Basic Glass Button</h2>
          <LiquidGlass width={200} height={80}>
            <button className={styles.button}>Click Me</button>
          </LiquidGlass>
        </div>

        <div className={styles.demo}>
          <h2>Glass Card</h2>
          <LiquidGlass width={300} height={200} shapeRadius={30}>
            <div className={styles.card}>
              <h3>Glass Card</h3>
              <p>This is a card with liquid glass effect</p>
            </div>
          </LiquidGlass>
        </div>

        <div className={styles.demo}>
          <h2>Rounded Glass</h2>
          <LiquidGlass
            width={150}
            height={150}
            shapeRadius={100}
            blur={30}
            glareFactor={150}
          >
            <div className={styles.circle}>
              <span>Icon</span>
            </div>
          </LiquidGlass>
        </div>

        <div className={styles.demo}>
          <h2>Custom Tint</h2>
          <LiquidGlass
            width={250}
            height={100}
            tint={{ r: 100, g: 200, b: 255, a: 0.3 }}
            blur={25}
          >
            <div className={styles.tintedCard}>
              <p>Blue tinted glass</p>
            </div>
          </LiquidGlass>
        </div>
      </div>

      <footer className={styles.footer}>
        <p>
          Based on{' '}
          <a
            href="https://github.com/iyinchao/liquid-glass-studio"
            target="_blank"
            rel="noopener noreferrer"
          >
            Liquid Glass Studio
          </a>{' '}
          by iyinchao
        </p>
      </footer>
    </div>
  );
}

export default App;
