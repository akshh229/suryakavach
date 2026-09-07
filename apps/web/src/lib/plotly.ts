// Bind react-plotly.js to the partial plotly.js bundle.
//
// `import Plot from 'react-plotly.js'` would pull full plotly.js (~4.1 MB),
// which is why the production chunk was 4.5 MB. The basic dist (~1.1 MB)
// carries every feature we use: scatter with fill, log axes, multiple
// overlaying axes, and layout shapes. Both chart components import Plot
// from here so there is exactly one Plotly in the bundle.
import createPlotlyComponent from 'react-plotly.js/factory';
import PlotlyBasic from 'plotly.js-basic-dist-min';

export const Plot = createPlotlyComponent(PlotlyBasic);
