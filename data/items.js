// Normalized Find data and the legacy QR Jewelry Catalog compatibility adapter.
//
// Status values: "available" | "reserved" | "sold"
// The legacyCategory field is temporary compatibility metadata used only to
// preserve the category value expected by the current item renderer.

function freezeFind(find) {
  find.price = Object.freeze(find.price);
  find.photos = Object.freeze(find.photos.slice());
  find.relatedFindIds = Object.freeze(find.relatedFindIds.slice());
  return Object.freeze(find);
}

var betweenUsFinds = Object.freeze([
  freezeFind({
    publicId: "BU-0001",
    legacyId: 1,
    slug: "gold-twisted-rope-bracelet",
    title: "Gold Twisted Rope Bracelet",
    collection: "jewelry",
    legacyCategory: "bracelet",
    description: "Delicate 18k gold-tone twisted rope bracelet. Lightweight and elegant. Fits most wrist sizes. Lobster clasp closure.",
    condition: null,
    availability: "available",
    price: { amount: 28, currency: "USD" },
    photos: ["assets/images/gold-twisted-rope-bracelet-01.jpeg"],
    primaryPhoto: "assets/images/gold-twisted-rope-bracelet-01.jpeg",
    altText: "Gold Twisted Rope Bracelet",
    relatedFindIds: ["BU-0002", "BU-0004"],
    featured: false,
    createdAt: null,
    updatedAt: null
  }),
  freezeFind({
    publicId: "BU-0002",
    legacyId: 2,
    slug: "silver-stackable-ring-set",
    title: "Silver Stackable Ring Set",
    collection: "jewelry",
    legacyCategory: "ring",
    description: "Set of 3 thin silver-tone stackable rings. Smooth finish. Sold as a set. Size 7.",
    condition: null,
    availability: "available",
    price: { amount: 18, currency: "USD" },
    photos: ["assets/images/placeholder-ring-silver.jpg"],
    primaryPhoto: "assets/images/placeholder-ring-silver.jpg",
    altText: "Silver Stackable Ring Set",
    relatedFindIds: ["BU-0001", "BU-0005"],
    featured: false,
    createdAt: null,
    updatedAt: null
  }),
  freezeFind({
    publicId: "BU-0003",
    legacyId: 3,
    slug: "pearl-drop-earrings",
    title: "Pearl Drop Earrings",
    collection: "jewelry",
    legacyCategory: "earrings",
    description: "Faux pearl drop earrings with gold-tone posts. Classic style. Hypoallergenic posts. Approx 1.5 inches long.",
    condition: null,
    availability: "reserved",
    price: { amount: 22, currency: "USD" },
    photos: ["assets/images/placeholder-earrings-pearl.jpg"],
    primaryPhoto: "assets/images/placeholder-earrings-pearl.jpg",
    altText: "Pearl Drop Earrings",
    relatedFindIds: ["BU-0004", "BU-0005"],
    featured: false,
    createdAt: null,
    updatedAt: null
  }),
  freezeFind({
    publicId: "BU-0004",
    legacyId: 4,
    slug: "layered-gold-chain-necklace",
    title: "Layered Gold Chain Necklace",
    collection: "jewelry",
    legacyCategory: "necklace",
    description: "Two-layer gold-tone chain necklace. 16 and 18 inch layers. Lobster clasp. Great for everyday wear.",
    condition: null,
    availability: "available",
    price: { amount: 35, currency: "USD" },
    photos: ["assets/images/layered-gold-chain-necklace-01.jpeg"],
    primaryPhoto: "assets/images/layered-gold-chain-necklace-01.jpeg",
    altText: "Layered Gold Chain Necklace",
    relatedFindIds: ["BU-0001", "BU-0003"],
    featured: false,
    createdAt: null,
    updatedAt: null
  }),
  freezeFind({
    publicId: "BU-0005",
    legacyId: 5,
    slug: "crystal-stud-earrings",
    title: "Crystal Stud Earrings",
    collection: "jewelry",
    legacyCategory: "earrings",
    description: "Small clear crystal stud earrings. Gold-tone setting. Hypoallergenic posts. Subtle sparkle.",
    condition: null,
    availability: "sold",
    price: { amount: 14, currency: "USD" },
    photos: ["assets/images/crystal-stud-earrings-01.jpeg"],
    primaryPhoto: "assets/images/crystal-stud-earrings-01.jpeg",
    altText: "Crystal Stud Earrings",
    relatedFindIds: ["BU-0002", "BU-0003"],
    featured: false,
    createdAt: null,
    updatedAt: null
  })
]);

var findsByPublicId = Object.create(null);
var findsByLegacyId = Object.create(null);
var findsBySlug = Object.create(null);

betweenUsFinds.forEach(function (find) {
  findsByPublicId[find.publicId] = find;
  findsByLegacyId[find.legacyId] = find;
  findsBySlug[find.slug] = find;
});

function findByPublicId(publicId) {
  if (typeof publicId !== "string") return null;
  return findsByPublicId[publicId] || null;
}

function findByLegacyId(legacyId) {
  if (!Number.isInteger(legacyId)) return null;
  return findsByLegacyId[legacyId] || null;
}

function findBySlug(slug) {
  if (typeof slug !== "string") return null;
  return findsBySlug[slug] || null;
}

function toLegacyItem(find) {
  return Object.freeze({
    id: find.legacyId,
    name: find.title,
    price: find.price.amount,
    description: find.description,
    status: find.availability,
    category: find.legacyCategory,
    image: find.primaryPhoto,
    relatedIds: Object.freeze(find.relatedFindIds.map(function (publicId) {
      return findsByPublicId[publicId].legacyId;
    }))
  });
}

// Derive the current runtime contract from the normalized source. The legacy
// records remain in the same order and retain their exact pre-M02 values.
var jewelryItems = Object.freeze(betweenUsFinds.map(toLegacyItem));

window.BETWEEN_US_FINDS = betweenUsFinds;
window.BETWEEN_US_DATA = Object.freeze({
  findByPublicId: findByPublicId,
  findByLegacyId: findByLegacyId,
  findBySlug: findBySlug
});

// Keep the current pages and every item.html?id=N URL working without renderer
// changes, module loading, a bundler, or asynchronous data access.
window.JEWELRY_ITEMS = jewelryItems;
