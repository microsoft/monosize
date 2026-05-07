import classes from './smoke.module.css';

export function smoke() {
  const root = document.createElement('div');
  root.className = classes.card;

  const title = document.createElement('span');
  title.className = classes.cardTitle;
  title.textContent = 'Smoke';
  root.append(title);

  document.body.append(root);
}
