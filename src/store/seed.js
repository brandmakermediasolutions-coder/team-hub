// Real starting data for Team Hub, taken from the BM333 Master Tracker (CS + Post Tracker sheets)
// and the PPC client list. Dates are fixed so the same data can be loaded into the shared database.

export const DEPARTMENTS = ['Management', 'Social Media', 'Performance Marketing', 'SEO', 'Creative', 'Content']
export const SERVICES = ['Social Media', 'Performance Marketing', 'SEO', 'Creative', 'Website']

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'review', label: 'In review' },
  { id: 'waiting', label: 'Waiting on client' },
  { id: 'done', label: 'Done' },
]

export const EMAIL_DOMAIN = 'brandmaker333.com'
export const emailFor = (name = '') => (name.trim().split(/\s+/)[0] ? `${name.trim().split(/\s+/)[0].toLowerCase()}@${EMAIL_DOMAIN}` : '')

export const POST_KINDS = ['Reel', 'Static', 'Carousel', 'Story', 'Repost', 'Post']
export const POST_STATUSES = [
  { id: 'not_ready', label: 'Not ready' },
  { id: 'ready', label: 'Ready' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'posted', label: 'Posted' },
]

// short names for services: in lists ("PPC") and inside task titles ("Monthly social media report")
export const SERVICE_SHORT = { 'Social Media': 'Social Media', 'Performance Marketing': 'PPC', SEO: 'SEO', Creative: 'Creative', Website: 'Website' }
export const SERVICE_IN_TITLE = { 'Social Media': 'social media', 'Performance Marketing': 'PPC', SEO: 'SEO', Creative: 'creative', Website: 'website' }
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Repeating rules that ship with Team Hub (also inserted by supabase/migrations/2026-11-13-batch1.sql)
export function defaultRules() {
  const created = at('2026-11-13', 9)
  return [
    { id: 'R-1', title: 'Monthly {service} report — {client}', scope: 'service', services: ['Social Media', 'Performance Marketing', 'SEO'], clientId: null,
      assign: 'service', personId: null, freq: 'monthly', day: 1, dueDay: 5, active: true, createdAt: created },
    { id: 'R-2', title: 'Weekly PPC report — {client}', scope: 'service', services: ['Performance Marketing'], clientId: null,
      assign: 'service', personId: null, freq: 'weekly', day: 1, dueDay: 1, active: true, createdAt: created },
  ]
}

// Starter task templates. who: 'owner' (account manager) | 'service' (that service's person) | 'person'
export function defaultTemplates() {
  const created = at('2026-11-13', 9)
  const i = (title, days, assign = 'service', service = null) => ({ title, assign, service, personId: null, days })
  const SM = 'Social Media', PM = 'Performance Marketing', SEO = 'SEO'
  return [
    { id: 'TPL-1', name: 'New social media client', createdAt: created, items: [
      i('Kick-off call and brand questionnaire', 1, 'owner'),
      i('Collect page logins, brand kit and assets', 2, 'owner'),
      i('Competitor and audience research', 4, 'service', SM),
      i('Content pillars and tone of voice', 5, 'service', SM),
      i('Profile, cover and highlight refresh', 6, 'service', 'Creative'),
      i('First month content calendar', 7, 'service', SM),
      i('Send content calendar for client approval', 8, 'owner'),
    ] },
    { id: 'TPL-2', name: 'New PPC client', createdAt: created, items: [
      i('Get ad account and Business Manager access', 1, 'service', PM),
      i('Set up pixel and conversion tracking', 3, 'service', PM),
      i('Keyword and audience research', 4, 'service', PM),
      i('Campaign structure and budget plan', 5, 'service', PM),
      i('Ad copy and creative brief', 6, 'service', PM),
      i('Ad creatives', 8, 'service', 'Creative'),
      i('Launch campaigns and check tracking', 10, 'service', PM),
    ] },
    { id: 'TPL-3', name: 'New SEO client', createdAt: created, items: [
      i('Get Search Console, Analytics and website access', 1, 'service', SEO),
      i('Technical site audit', 4, 'service', SEO),
      i('Keyword research and target pages', 6, 'service', SEO),
      i('Competitor backlink check', 7, 'service', SEO),
      i('On-page fixes list for the website', 9, 'service', SEO),
      i('Share the 3-month SEO plan with the client', 10, 'owner'),
    ] },
  ]
}

const at = (iso, hour = 11) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00+05:30`).getTime()

const emp = (id, name, title, department, role, headId, color) =>
  ({ id, name, title, department, role, headId, email: emailFor(name), phone: '', color, active: true, createdAt: at('2026-11-12', 9) })

export function buildSeed() {
  const employees = [
    emp('BM-001', 'Bidhan', 'Admin', 'Management', 'admin', null, '#F04E23'),
    emp('BM-002', 'Niyati Shah', 'Head of Social Media', 'Social Media', 'head', 'BM-001', '#E0447C'),
    emp('BM-003', 'Jesika', 'Sr. Social Media Manager', 'Social Media', 'member', 'BM-002', '#8E44AD'),
    emp('BM-004', 'Viaana', 'Social Media Strategist', 'Social Media', 'member', 'BM-002', '#C77D0A'),
    emp('BM-005', 'Shruti', 'Social Media Manager', 'Social Media', 'member', 'BM-002', '#2F80ED'),
    emp('BM-006', 'Mariya', 'Social Media Manager', 'Social Media', 'member', 'BM-002', '#0E9F8E'),
    emp('BM-007', 'Puneet', 'Social Media Manager', 'Social Media', 'member', 'BM-002', '#D9480F'),
    emp('BM-008', 'Akshay', 'Head of Performance Marketing', 'Performance Marketing', 'head', 'BM-001', '#6D5AE6'),
    emp('BM-009', 'Shashank', 'Performance Marketing Specialist', 'Performance Marketing', 'member', 'BM-008', '#0B7285'),
    emp('BM-010', 'Dipika', 'SEO Manager', 'SEO', 'head', 'BM-001', '#1F9D55'),
    emp('BM-011', 'Kavya', 'SEO Executive', 'SEO', 'member', 'BM-010', '#5F3DC4'),
    emp('BM-012', 'Mahesh', 'Head Graphic Designer', 'Creative', 'head', 'BM-001', '#B83280'),
    emp('BM-013', 'Saquib', 'Graphic Designer', 'Creative', 'member', 'BM-012', '#2B8A3E'),
    emp('BM-014', 'Akhilesh', 'Video Editor', 'Creative', 'member', 'BM-001', '#1971C2'),
    emp('BM-015', 'Sunny', 'Video Editor', 'Creative', 'member', 'BM-001', '#E8590C'),
    emp('BM-016', 'Aireen', 'Content Writer', 'Content', 'member', 'BM-002', '#9C36B5'),
  ]

  const palette = ['#E0447C', '#2F80ED', '#0E9F8E', '#8E44AD', '#C77D0A', '#D9480F', '#1F9D55', '#6D5AE6', '#0B7285', '#B83280']
  let n = 0
  const cl = (name, services, ownerId, memberIds, deliverables = '', ads = '', brief = '') => {
    n += 1
    return {
      id: `C-${String(n).padStart(2, '0')}`, name, services, ownerId, memberIds: [...new Set([ownerId, ...memberIds])],
      deliverables, ads, brief, color: palette[(n - 1) % palette.length], active: true, createdAt: at('2026-11-12', 9),
    }
  }
  const SM = 'Social Media', PM = 'Performance Marketing', SEO = 'SEO'

  const clients = [
    cl('Medialogy', [SM], 'BM-002', [], '10 posts (mix)'),
    cl('The Right College', [SM], 'BM-002', [], '12 posts (8 reels, 4 carousels) + 4 stories'),
    cl('Computer World', [SM], 'BM-002', [], 'Ad hoc'),
    cl('Kairoz', [SM], 'BM-002', []),
    cl('Brandmaker333', [SM], 'BM-002', ['BM-001'], '', '', 'Our own brand.'),
    cl('The Indian Mudra', [SM, PM], 'BM-003', ['BM-009'], '10 posts (mix) + 10 stories', 'FB · Sales'),
    cl('Megamont', [SM, SEO], 'BM-003', ['BM-010'], '12 posts (mix) + 10 stories (value add)'),
    cl('CMJ | Asgard', [SM, SEO], 'BM-003', ['BM-010'], '5 posts (mix) + 5 stories', '', 'Two pages: CMJ and Asgard. Posts go out on both.'),
    cl('Ronak LinkedIn', [SM], 'BM-003', [], '4 static posts'),
    cl('Prince AV', [SM, PM], 'BM-003', ['BM-009'], '8 posts (mix) + 8 stories'),
    cl('Euphonic', [SM, PM], 'BM-003', ['BM-009'], '8 posts (mix) + 8 stories'),
    cl('Ruff Kids', [SM, PM], 'BM-005', ['BM-009'], '4 reels, 6 statics, 4 stories', 'FB · Boosting (6–12 Nov)'),
    cl('Anytime Fitness', [SM, PM], 'BM-005', ['BM-009'], '', 'Google & FB · Lead gen'),
    cl('River Blue', [SM], 'BM-005', []),
    cl('Dava Discount', [SM, PM], 'BM-005', ['BM-008'], '', 'Google & FB · Lead gen'),
    cl('Dhobi Xpress', [SM, PM], 'BM-005', ['BM-008'], '', 'FB · Lead gen'),
    cl('Lenora', [SM], 'BM-006', ['BM-004'], '12 posts + 10 stories'),
    cl('BSS', [SM, PM], 'BM-006', ['BM-008'], '', 'FB · Lead gen'),
    cl('New Look', [SM, PM], 'BM-006', ['BM-009'], '2 posts', 'FB · Sales'),
    cl('Garden Fresh', [SM], 'BM-006', [], '15 posts + 10 stories'),
    cl('Panache – Bayaan', [SM], 'BM-007', []),
    cl('Panache – Ek Radha', [SM], 'BM-007', []),
    cl('Mahabali', [SM], 'BM-007', []),
    cl('Whora Estate', [SM, PM], 'BM-004', ['BM-008'], '', 'FB · Lead gen'),
    cl('Linkloom', [SM], 'BM-004', []),
    cl('BM333 Production', [PM], 'BM-008', [], '', 'Google · Lead gen', 'Our own production arm.'),
  ]
  const C = Object.fromEntries(clients.map((c) => [c.name, c.id]))

  // ---------- open work, taken from the 12–13 Nov tracker columns ----------
  let tn = 100
  const t = (title, client, assigneeId, assignedById, due, status, extra = {}) => {
    tn += 1
    return {
      id: `T-${tn}`, title, clientId: client ? C[client] : null, assigneeId, assignedById, due, status,
      urgent: false, notes: '', links: [], createdAt: at('2026-11-11', 15), updatedAt: at('2026-11-12', 12),
      completedAt: status === 'done' ? at('2026-11-12', 17) : null, ...extra,
    }
  }
  const tasks = [
    t('Black Friday sale static posts', 'The Indian Mudra', 'BM-003', 'BM-002', '2026-11-13', 'todo', { urgent: true }),
    t('Sort story highlights', 'The Indian Mudra', 'BM-003', 'BM-003', '2026-11-13', 'todo'),
    t('Discuss Black Friday offers with client', 'The Indian Mudra', 'BM-009', 'BM-008', '2026-11-13', 'todo', { urgent: true }),
    t('Social media topics approval', 'Megamont', 'BM-003', 'BM-003', '2026-11-14', 'waiting', { notes: 'Topics shared with client, approval pending.' }),
    t('Personal LinkedIn accounts (8)', 'Megamont', 'BM-003', 'BM-003', '2026-11-17', 'waiting', { notes: '4 created, verification pending. Data for the other 4 pending from client.' }),
    t('Follow up: banner, logo revamp options, questionnaire', 'Megamont', 'BM-003', 'BM-003', '2026-11-14', 'waiting'),
    t('Send pending posts for approval and share captions', 'CMJ | Asgard', 'BM-003', 'BM-003', '2026-11-13', 'todo'),
    t('Design stories', 'CMJ | Asgard', 'BM-013', 'BM-003', '2026-11-14', 'todo'),
    t('Send 4 posts for approval', 'Ronak LinkedIn', 'BM-003', 'BM-003', '2026-11-13', 'todo'),
    t('Schedule pending monthly posts', 'Prince AV', 'BM-003', 'BM-003', '2026-11-13', 'todo'),
    t('Video script (after client shares product package)', 'Euphonic', 'BM-003', 'BM-003', '2026-11-18', 'waiting', { notes: 'Also fix the shoot date.' }),
    t('Acceptance post — changes', 'The Right College', 'BM-002', 'BM-002', '2026-11-13', 'doing'),
    t('Automation guide', 'The Right College', 'BM-002', 'BM-002', '2026-11-15', 'waiting', { notes: 'Pending from client side.' }),
    t('Reel changes', 'Medialogy', 'BM-002', 'BM-002', '2026-11-13', 'doing'),
    t('Bitex flyer — feedback on reshared version', 'Computer World', 'BM-002', 'BM-002', '2026-11-14', 'waiting'),
    t('New content calendar', 'Ruff Kids', 'BM-005', 'BM-005', '2026-11-13', 'doing'),
    t('Edit the shoot reel', 'Anytime Fitness', 'BM-014', 'BM-005', '2026-11-13', 'todo', { urgent: true }),
    t('Ad size adaptations (5 ads)', 'Lenora', 'BM-006', 'BM-006', '2026-11-13', 'doing'),
    t('Changes to 2 creatives', 'BSS', 'BM-006', 'BM-006', '2026-11-13', 'doing'),
    t('Ad reel assets', 'Panache – Bayaan', 'BM-007', 'BM-007', '2026-11-14', 'doing'),
    t('Ad statics', 'Mahabali', 'BM-007', 'BM-007', '2026-11-14', 'doing'),
    t('Ad copies — awaiting client feedback', 'Whora Estate', 'BM-004', 'BM-004', '2026-11-14', 'waiting'),
    t('Identify Instagram pages for reference', 'Brandmaker333', 'BM-001', 'BM-001', '2026-11-15', 'todo'),
    t('8 ad creatives with adapts', 'Lenora', 'BM-004', 'BM-004', '2026-11-12', 'done'),
  ]

  const comments = [
    { id: 'CM-1', taskId: 'T-117', authorId: 'BM-005', text: '@Akhilesh footage is in the shared Drive folder. Need a 30s cut for Instagram.', at: at('2026-11-12', 16) },
  ]

  // ---------- daily updates for 12 Nov (the tracker's date column) ----------
  const up = (employeeId, client, text, date = '2026-11-12') =>
    ({ id: `U-${date}-${employeeId}-${C[client]}`, employeeId, clientId: C[client], date, text, at: at(date, 18) })
  const updates = [
    up('BM-002', 'Medialogy', 'Reel changes to be done. 1 static posted, 1 static approval pending.'),
    up('BM-002', 'The Right College', 'Story posted. Automation guide pending from client. Acceptance post changes to be done. Carousel for 16th shared with client.'),
    up('BM-002', 'Computer World', 'Word document shared with changes for Arabic translation. Bitex flyer changes done and reshared.'),
    up('BM-003', 'The Indian Mudra', 'Black Friday sale static posts to be created.'),
    up('BM-009', 'The Indian Mudra', 'Black Friday offers to be discussed with client.'),
    up('BM-003', 'Megamont', 'Topics shared (approval pending). LinkedIn accounts: 4 created, verification pending. 1 static shared for approval. Following up banner, logo options and questionnaire.'),
    up('BM-003', 'CMJ | Asgard', 'Following up posts approval.'),
    up('BM-003', 'Prince AV', 'Static post received from Tousif.'),
    up('BM-003', 'Euphonic', 'Following up product package for script. Shoot date to be fixed.'),
    up('BM-005', 'Ruff Kids', 'Posted reel. Working on new content calendar.'),
    up('BM-005', 'Anytime Fitness', 'Shoot reel needs editing.'),
    up('BM-006', 'Lenora', 'Ad size adaptations (5 ads).'),
    up('BM-006', 'BSS', 'Changes to 2 creatives.'),
    up('BM-006', 'New Look', '1 reel created.'),
    up('BM-007', 'Panache – Bayaan', 'Ad reel assets (WIP).'),
    up('BM-007', 'Mahabali', 'Ad statics.'),
    up('BM-004', 'Lenora', '4 ad creatives with adapts done today. All 8 creatives completed.'),
    up('BM-004', 'Whora Estate', 'Copies done, shared with client, awaiting feedback.'),
    up('BM-004', 'Linkloom', '1 static done.'),
  ]

  // ---------- November post calendar (Post Tracker sheet) ----------
  let pn = 0
  const P = (client, day, kind, status, note = '') => {
    pn += 1
    return { id: `PO-${pn}`, clientId: C[client], date: `2026-11-${String(day).padStart(2, '0')}`, kind, status, note, createdBy: null, at: at('2026-11-01', 10) }
  }
  const posts = [
    ...[[6, 'Static', 'posted'], [8, 'Static', 'posted'], [13, 'Post', 'not_ready'], [17, 'Post', 'not_ready'], [21, 'Post', 'not_ready'], [24, 'Post', 'not_ready'], [28, 'Post', 'not_ready']]
      .map(([d, k, s]) => P('CMJ | Asgard', d, k, s)),
    ...[[5, 'Reel'], [6, 'Static'], [8, 'Static'], [9, 'Reel']].map(([d, k]) => P('Prince AV', d, k, 'posted')),
    ...[[5, 'Repost'], [6, 'Static'], [7, 'Repost'], [8, 'Static'], [9, 'Repost'], [11, 'Repost']].map(([d, k]) => P('Euphonic', d, k, 'posted')),
    ...[[2, 'Reel'], [4, 'Carousel'], [6, 'Reel'], [6, 'Static'], [8, 'Static'], [9, 'Carousel']].map(([d, k]) => P('The Indian Mudra', d, k, 'posted')),
    P('The Right College', 4, 'Carousel', 'posted', 'Award post'),
    ...[[5, 'Story'], [6, 'Reel'], [11, 'Reel'], [12, 'Story'], [13, 'Reel']].map(([d, k]) => P('The Right College', d, k, 'posted')),
    P('The Right College', 16, 'Carousel', 'ready'),
    ...[[18, 'Reel'], [19, 'Story'], [20, 'Carousel'], [23, 'Reel'], [25, 'Reel'], [26, 'Story'], [27, 'Reel'], [30, 'Reel']].map(([d, k]) => P('The Right College', d, k, 'not_ready')),
    ...[[4, 'Carousel'], [8, 'Static'], [9, 'Static'], [11, 'Static'], [12, 'Static']].map(([d, k]) => P('Medialogy', d, k, 'posted')),
  ]

  const activity = [
    { id: 'A-1', at: at('2026-11-12', 16), actorId: 'BM-005', type: 'assigned', text: 'assigned "Edit the shoot reel" to Akhilesh', taskId: 'T-117', clientId: C['Anytime Fitness'], targetId: 'BM-014' },
    { id: 'A-2', at: at('2026-11-12', 15), actorId: 'BM-003', type: 'assigned', text: 'assigned "Design stories" to Saquib', taskId: 'T-108', clientId: C['CMJ | Asgard'], targetId: 'BM-013' },
    { id: 'A-3', at: at('2026-11-12', 12), actorId: 'BM-008', type: 'assigned', text: 'assigned "Discuss Black Friday offers with client" to Shashank', taskId: 'T-103', clientId: C['The Indian Mudra'], targetId: 'BM-009' },
    { id: 'A-4', at: at('2026-11-12', 11), actorId: 'BM-002', type: 'assigned', text: 'assigned "Black Friday sale static posts" to Jesika', taskId: 'T-101', clientId: C['The Indian Mudra'], targetId: 'BM-003' },
  ]

  return { employees, clients, tasks, comments, updates, posts, activity, rules: defaultRules(), templates: defaultTemplates(), repeatRuns: [] }
}
