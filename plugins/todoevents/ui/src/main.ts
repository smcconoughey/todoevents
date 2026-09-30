import { App } from '@modelcontextprotocol/ext-apps';
import { TodoEventsWidget } from './widget';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;

async function initialize(): Promise<void> {
  // Demo code is excluded from the production build. It can never publish events.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { startDemo } = await import('./demo'); await startDemo(root); return;
  }
  const app = new App({ name: 'Todo Events', version: '1.0.0' }, {}, { autoResize: true });
  const widget = new TodoEventsWidget(root, {
    call: (name, args) => app.callServerTool({ name, arguments: args }),
    openLink: async url => { const result = await app.openLink({ url }); if (result.isError) throw new Error('Link rejected'); },
    message: async text => { const result = await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] }); if (result.isError) throw new Error('Message rejected'); },
  });
  app.addEventListener('toolresult', result => widget.receive(result));
  app.addEventListener('toolcancelled', () => widget.cancelled());
  app.addEventListener('hostcontextchanged', context => { if (context.theme) document.documentElement.dataset.theme = context.theme; });
  try { await app.connect(); await widget.ready(); }
  catch { widget.disconnected(); }
}
void initialize();
