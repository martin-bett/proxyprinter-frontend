import { nameFromLink, parseLinkList } from './LinkListDialog';

test('splits by comma, semicolon, whitespace and new lines and drops duplicates', () => {
  expect(parseLinkList('https://i.redd.it/a.png, https://i.redd.it/b.jpg;https://i.redd.it/c.webp\nhttps://i.redd.it/a.png  no-link'))
    .toEqual(['https://i.redd.it/a.png', 'https://i.redd.it/b.jpg', 'https://i.redd.it/c.webp']);
});

test('ignores empty input', () => {
  expect(parseLinkList(' ;, \n')).toEqual([]);
});

test('uses the file name as card name', () => {
  expect(nameFromLink('https://preview.redd.it/iron-fist-v0-abc.png?width=640')).toBe('iron-fist-v0-abc');
  expect(nameFromLink('https://example.com/')).toBe('custom-card');
});
