import 'smoke-rspack-styles';

// Top-level side-effect prevents the bundler from tree-shaking the entry
// down to nothing.
const root = document.createElement('div');
root.className = 'smoke-card';

const title = document.createElement('span');
title.className = 'title';
title.textContent = 'Smoke';
root.append(title);

document.body.append(root);

export default { name: 'smoke' };
