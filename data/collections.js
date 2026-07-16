// Authoritative Between Us Collection registry.
// Collection records describe catalog groupings only; Find data remains in
// data/items.js.

function freezeCollection(collection) {
  return Object.freeze(collection);
}

var betweenUsCollections = Object.freeze([
  freezeCollection({
    id: "jewelry",
    label: "Jewelry",
    description: "Wearable finds selected for style, detail, and everyday discovery.",
    status: "active",
    sortOrder: 1
  }),
  freezeCollection({
    id: "vintage",
    label: "Vintage",
    description: "Distinctive pieces with character, history, and lasting appeal.",
    status: "coming-soon",
    sortOrder: 2
  }),
  freezeCollection({
    id: "home-decor",
    label: "Home & Decor",
    description: "Useful and decorative finds for comfortable, personal spaces.",
    status: "coming-soon",
    sortOrder: 3
  }),
  freezeCollection({
    id: "kitchen",
    label: "Kitchen",
    description: "Practical kitchen finds chosen for everyday use.",
    status: "coming-soon",
    sortOrder: 4
  }),
  freezeCollection({
    id: "collectibles",
    label: "Collectibles",
    description: "Interesting pieces worth noticing, keeping, or sharing.",
    status: "coming-soon",
    sortOrder: 5
  }),
  freezeCollection({
    id: "new-items",
    label: "New Items",
    description: "Unused finds offered locally at honest prices.",
    status: "coming-soon",
    sortOrder: 6
  })
]);

window.BETWEEN_US_COLLECTIONS = betweenUsCollections;
