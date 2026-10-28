const navigationItems = [
  { href: '/#home', label: 'Home' },
  { href: '/#career', label: 'Career' },
  { href: '/#contact', label: 'Contact' },
];

export const layout = {
  header: { navigation: { items: navigationItems }, ctaButton: 'Resume' },
  footer: {
    name: 'Kevin Sauvage',
    tagline:
      'Frontend Software Engineer at Keolis Group (remote), based in Barcelona. I build fast, accessible web products that people enjoy using.',
    sections: {
      quickLinks: { title: 'Quick Links', links: navigationItems },
    },
  },
};
