import mediumZoom from 'medium-zoom';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

// onRouteDidUpdate is a Docusaurus lifecycle hook called after React has
// finished updating the DOM — on initial load AND every client-side navigation.
export function onRouteDidUpdate() {
  if (ExecutionEnvironment.canUseDOM) {
    mediumZoom('.markdown img:not(.no-zoom)', {
      background: 'var(--ifm-background-color)',
      margin: 24,
    });
  }
}
