// Names and wording used across the site. Change them here, not in the pages.
export const SITE = {
  brand: 'Whistle',
  endorsement: 'by Framehouse',
  company: 'Wakanda Innovations Lab',
  tagline: 'The crowd’s verdict, measured',
  description:
    'The Whistle Score reads public posts from the month before a film’s release to the month after, and turns the conversation into one number.',
  // Shown at the top of every page while the site is a preview. Set to '' to hide.
  // Legal pages (/privacy, /terms). Fill these in before launch; empty values show a visible placeholder.
  legal: {
    entity: 'Wakanda Innovations Lab', // registered legal name of the company
    address: '', // registered office address
    // Where /contact messages go. Never printed on the page: the browser only sees an encoded copy.
    contactEmail: 'wakandainnov@gmail.com',
    // Optional form service (Formspree, Web3Forms...). When set, the form posts here and sends without
    // opening the visitor's email app. Left empty, "Send" opens their email app with the message filled in.
    formEndpoint: '',
    grievanceOfficer: '', // name of the Grievance Officer (India's DPDP Act and IT Rules)
    courts: '', // city whose courts handle disputes, e.g. 'Chennai'
    updated: '2026-11-16',
    draft: true, // shows "Draft, to be reviewed before launch" on both pages
  },
  previewNote: 'Preview with sample data. Films tagged “Sample” have made-up scores for design purposes. Streaming info is real.',
};

// Language filters on the homepage, in launch order.
export const LANGUAGES = ['Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Hindi', 'English'] as const;
