// Sample jewelry items for the QR Jewelry Catalog MVP.
// Each item represents one boxed jewelry piece available for sale.
//
// Status values: "available" | "reserved" | "sold"
// relatedIds: array of other item ids the buyer might also like

var jewelryItems = [
  {
    id: 1,
    name: "Gold Twisted Rope Bracelet",
    price: 28,
    description: "Delicate 18k gold-tone twisted rope bracelet. Lightweight and elegant. Fits most wrist sizes. Lobster clasp closure.",
    status: "available",
    category: "bracelet",
    image: "assets/images/placeholder-bracelet-gold.jpg",
    relatedIds: [2, 4]
  },
  {
    id: 2,
    name: "Silver Stackable Ring Set",
    price: 18,
    description: "Set of 3 thin silver-tone stackable rings. Smooth finish. Sold as a set. Size 7.",
    status: "available",
    category: "ring",
    image: "assets/images/placeholder-ring-silver.jpg",
    relatedIds: [1, 5]
  },
  {
    id: 3,
    name: "Pearl Drop Earrings",
    price: 22,
    description: "Faux pearl drop earrings with gold-tone posts. Classic style. Hypoallergenic posts. Approx 1.5 inches long.",
    status: "reserved",
    category: "earrings",
    image: "assets/images/placeholder-earrings-pearl.jpg",
    relatedIds: [4, 5]
  },
  {
    id: 4,
    name: "Layered Gold Chain Necklace",
    price: 35,
    description: "Two-layer gold-tone chain necklace. 16 and 18 inch layers. Lobster clasp. Great for everyday wear.",
    status: "available",
    category: "necklace",
    image: "assets/images/placeholder-necklace-gold.jpg",
    relatedIds: [1, 3]
  },
  {
    id: 5,
    name: "Crystal Stud Earrings",
    price: 14,
    description: "Small clear crystal stud earrings. Gold-tone setting. Hypoallergenic posts. Subtle sparkle.",
    status: "sold",
    category: "earrings",
    image: "assets/images/placeholder-earrings-crystal.jpg",
    relatedIds: [2, 3]
  }
];

// Expose items globally so index.html and item.html can access this data
// without needing a module system or bundler.
window.JEWELRY_ITEMS = jewelryItems;
