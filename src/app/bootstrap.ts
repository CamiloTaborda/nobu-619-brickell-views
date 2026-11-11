/** Solo en el navegador: hidrata el store desde la URL antes del primer render. */
import { dismissSplash } from '../features/splash/dismiss';
import App from './App';
import { startKeyboard, startRouter } from './router';

startRouter();
startKeyboard();
void dismissSplash();

export default App;
