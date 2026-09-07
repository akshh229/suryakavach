// plotly.js-basic-dist-min ships without its own type declarations. It is
// the same Plotly API surface as the full library (a bundled subset), so the
// plotly.js types are accurate for the parts we use.
declare module 'plotly.js-basic-dist-min' {
  import * as Plotly from 'plotly.js';
  const PlotlyBasic: typeof Plotly;
  export default PlotlyBasic;
}
