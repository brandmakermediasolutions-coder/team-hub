import { addDays } from '../lib/date'

const H = 3600000
const ago = (hours) => Date.now() - hours * H

export const TEAMS = ['Management', 'Strategy', 'Social Media', 'PPC', 'SEO & Web', 'Production']
export const SERVICES = ['Social Media', 'PPC', 'SEO', 'Website', 'Production', 'Outdoor']

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'progress', label: 'In progress' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' },
]
export const PRIORITIES = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

// Demo accounts. Every demo password is "demo123" (prototype only — real auth comes with the backend).
const PW = 'demo123'
const emp = (id, name, role, title, team, headId, color) => ({ id, name, role, title, team, headId, color, active: true, password: PW })

export function buildSeed() {
  const employees = [
    emp('BM-001', 'Bidhan', 'admin', 'Founder & Director', 'Management', null, '#F04E23'),
    emp('BM-002', 'Akshay', 'head', 'Digital Strategist', 'Strategy', 'BM-001', '#6D5AE6'),
    emp('BM-003', 'Jesika', 'head', 'Social Media Team Lead', 'Social Media', 'BM-001', '#E0447C'),
    emp('BM-004', 'Dipika', 'head', 'Website & SEO Manager', 'SEO & Web', 'BM-001', '#0E9F8E'),
    emp('BM-005', 'Vinay', 'employee', 'Senior Motion Graphic Designer', 'Social Media', 'BM-003', '#2F80ED'),
    emp('BM-006', 'Riya', 'employee', 'Content Writer', 'Social Media', 'BM-003', '#C77D0A'),
    emp('BM-007', 'Karan', 'employee', 'Graphic Designer', 'Social Media', 'BM-003', '#8E44AD'),
    emp('BM-008', 'Sneha', 'employee', 'SEO Executive', 'SEO & Web', 'BM-004', '#1F9D55'),
    emp('BM-009', 'Arjun', 'employee', 'Web Developer', 'SEO & Web', 'BM-004', '#D9480F'),
    emp('BM-010', 'Meera', 'employee', 'PPC Specialist', 'PPC', 'BM-002', '#0B7285'),
    emp('BM-011', 'Rohit', 'employee', 'Video Editor', 'Production', 'BM-002', '#5F3DC4'),
  ]

  const clients = [
    { id: 'C-01', name: 'Aurora Skincare', industry: 'Beauty & D2C', services: ['Social Media', 'PPC', 'Production'], ownerId: 'BM-003', since: addDays(-210), color: '#E0447C', brief: 'Clean, science-backed skincare. Tone: warm, expert, never pushy. Avoid medical claims. Approvals go through Nisha (brand manager).' },
    { id: 'C-02', name: 'Urban Brew Café', industry: 'Food & Beverage', services: ['Social Media', 'Production'], ownerId: 'BM-003', since: addDays(-95), color: '#C77D0A', brief: 'Neighbourhood café chain, 6 outlets in Mumbai. Playful tone, lots of reels. Always tag the outlet location.' },
    { id: 'C-03', name: 'Zenith Realty', industry: 'Real Estate', services: ['PPC', 'Website', 'SEO'], ownerId: 'BM-002', since: addDays(-320), color: '#2F80ED', brief: 'Premium residential projects. Lead quality over volume. Every ad needs the RERA number. Weekly lead report every Monday.' },
    { id: 'C-04', name: 'FitNation Gyms', industry: 'Fitness', services: ['SEO', 'Website', 'Social Media'], ownerId: 'BM-004', since: addDays(-150), color: '#1F9D55', brief: '12 gym locations. Local SEO is the priority — one landing page per location. Energetic, no body-shaming language.' },
    { id: 'C-05', name: 'Kalakar Jewels', industry: 'Jewellery', services: ['Social Media', 'Outdoor', 'Production'], ownerId: 'BM-002', since: addDays(-40), color: '#8E44AD', brief: 'Heritage jewellery house launching a bridal line. Elegant, minimal copy. Festive campaign with hoardings in South Mumbai.' },
  ]

  const projects = [
    { id: 'P-01', clientId: 'C-01', name: 'Monthly Social Retainer', service: 'Social Media', memberIds: ['BM-003', 'BM-005', 'BM-006', 'BM-007'], status: 'active' },
    { id: 'P-02', clientId: 'C-01', name: 'Winter Glow Launch Ads', service: 'PPC', memberIds: ['BM-002', 'BM-010'], status: 'active' },
    { id: 'P-03', clientId: 'C-02', name: 'Reels & Content Calendar', service: 'Social Media', memberIds: ['BM-003', 'BM-005', 'BM-006'], status: 'active' },
    { id: 'P-04', clientId: 'C-03', name: 'Lead Generation Campaigns', service: 'PPC', memberIds: ['BM-002', 'BM-010'], status: 'active' },
    { id: 'P-05', clientId: 'C-03', name: 'Project Microsite', service: 'Website', memberIds: ['BM-004', 'BM-009'], status: 'active' },
    { id: 'P-06', clientId: 'C-04', name: 'Local SEO — 12 Locations', service: 'SEO', memberIds: ['BM-004', 'BM-008', 'BM-009'], status: 'active' },
    { id: 'P-07', clientId: 'C-05', name: 'Bridal Line Festive Campaign', service: 'Production', memberIds: ['BM-002', 'BM-011', 'BM-007'], status: 'active' },
  ]

  const t = (id, title, clientId, projectId, assigneeId, assignedById, dueOffset, priority, status, extra = {}) => ({
    id, title, clientId, projectId, assigneeId, assignedById,
    due: addDays(dueOffset), priority, status,
    description: '', doneWhen: '', links: [], blocked: null,
    createdAt: ago(extra.createdHoursAgo ?? 72),
    completedAt: status === 'done' ? ago(extra.doneHoursAgo ?? 20) : null,
    ...extra,
  })

  const tasks = [
    t('T-101', 'Design 6 carousel posts for Winter Glow range', 'C-01', 'P-01', 'BM-007', 'BM-003', 0, 'high', 'progress', { description: 'Use the new winter palette. Carousel 3 and 5 need product close-ups from the last shoot.', doneWhen: '6 carousels uploaded to Drive and shared for review', links: ['https://drive.google.com/'] }),
    t('T-102', 'Write captions + hashtags for December calendar', 'C-01', 'P-01', 'BM-006', 'BM-003', 1, 'medium', 'todo', { doneWhen: '20 captions in the content sheet, approved by Jesika' }),
    t('T-103', 'Edit 3 reels from café shoot (30s each)', 'C-02', 'P-03', 'BM-005', 'BM-003', -1, 'urgent', 'progress', { description: 'Trending audio for reel 1. Add outlet location tags as on-screen text.', doneWhen: '3 reels exported 9:16 and uploaded', blocked: { onId: 'BM-006', reason: 'Waiting for final on-screen text / hook lines' } }),
    t('T-104', 'Hook lines + on-screen text for café reels', 'C-02', 'P-03', 'BM-006', 'BM-005', 0, 'high', 'todo', { doneWhen: 'Text for all 3 reels sent to Vinay' }),
    t('T-105', 'Motion logo sting for Kalakar bridal film', 'C-05', 'P-07', 'BM-005', 'BM-002', 3, 'medium', 'todo', { doneWhen: '5s animated logo, gold on black, with sound' }),
    t('T-106', 'December content calendar — Urban Brew', 'C-02', 'P-03', 'BM-003', 'BM-001', 2, 'high', 'progress', { doneWhen: 'Calendar approved by client on email' }),
    t('T-107', 'Review Aurora carousel drafts', 'C-01', 'P-01', 'BM-003', 'BM-003', 1, 'medium', 'todo'),
    t('T-108', 'Set up Winter Glow Meta campaign (3 ad sets)', 'C-01', 'P-02', 'BM-010', 'BM-002', 0, 'high', 'review', { doneWhen: 'Campaign in draft with pixel events verified', description: 'Prospecting, retargeting and lookalike ad sets. ₹4,000/day to start.' }),
    t('T-109', 'Weekly lead report — Zenith Realty', 'C-03', 'P-04', 'BM-010', 'BM-002', -2, 'high', 'todo', { doneWhen: 'Report emailed to client with CPL by campaign' }),
    t('T-110', 'Add RERA number to all live Google ads', 'C-03', 'P-04', 'BM-010', 'BM-002', 1, 'urgent', 'progress'),
    t('T-111', 'Google Ads negative keyword clean-up', 'C-03', 'P-04', 'BM-010', 'BM-002', 5, 'low', 'todo'),
    t('T-112', 'Build microsite enquiry form + thank-you page', 'C-03', 'P-05', 'BM-009', 'BM-004', 2, 'high', 'progress', { doneWhen: 'Form submits to CRM sheet; conversion tag fires', links: ['https://vercel.com/'] }),
    t('T-113', 'Fix mobile page speed (LCP under 2.5s)', 'C-03', 'P-05', 'BM-009', 'BM-004', 6, 'medium', 'todo'),
    t('T-114', 'Location landing pages — batch 2 (4 gyms)', 'C-04', 'P-06', 'BM-009', 'BM-004', 4, 'medium', 'todo'),
    t('T-115', 'Keyword research for 12 gym locations', 'C-04', 'P-06', 'BM-008', 'BM-004', -1, 'high', 'review', { doneWhen: 'Sheet with primary + secondary keywords per location' }),
    t('T-116', 'Optimise Google Business Profiles (all outlets)', 'C-04', 'P-06', 'BM-008', 'BM-004', 3, 'medium', 'progress'),
    t('T-117', 'Monthly SEO report — FitNation', 'C-04', 'P-06', 'BM-008', 'BM-004', 7, 'medium', 'todo'),
    t('T-118', 'Edit bridal campaign hero film (60s)', 'C-05', 'P-07', 'BM-011', 'BM-002', 2, 'urgent', 'progress', { doneWhen: 'First cut shared with client for feedback', blocked: { onId: 'BM-005', reason: 'Needs the animated logo sting' } }),
    t('T-119', 'Hoarding creative — 3 size adaptations', 'C-05', 'P-07', 'BM-007', 'BM-002', 4, 'high', 'todo', { doneWhen: 'Print-ready files in 3 sizes, CMYK' }),
    t('T-120', 'Festive campaign media plan', 'C-05', 'P-07', 'BM-002', 'BM-001', 1, 'high', 'progress'),
    t('T-121', 'Quarterly strategy deck — Zenith Realty', 'C-03', 'P-04', 'BM-002', 'BM-001', 6, 'medium', 'todo'),
    t('T-122', 'Technical SEO audit — FitNation', 'C-04', 'P-06', 'BM-004', 'BM-001', 3, 'medium', 'progress'),
    t('T-123', 'Client onboarding call notes — Kalakar', 'C-05', 'P-07', 'BM-002', 'BM-001', -6, 'medium', 'done', { doneHoursAgo: 120 }),
    t('T-124', 'November reels batch — Aurora', 'C-01', 'P-01', 'BM-005', 'BM-003', -3, 'high', 'done', { doneHoursAgo: 50 }),
    t('T-125', 'Diwali offer static posts', 'C-02', 'P-03', 'BM-007', 'BM-003', -4, 'medium', 'done', { doneHoursAgo: 70 }),
    t('T-126', 'Install conversion tracking on microsite', 'C-03', 'P-05', 'BM-009', 'BM-004', -2, 'high', 'done', { doneHoursAgo: 30 }),
    t('T-127', 'November blog posts (4) — FitNation', 'C-04', 'P-06', 'BM-006', 'BM-004', -1, 'low', 'done', { doneHoursAgo: 26 }),
    t('T-128', 'Retargeting audience setup — Aurora', 'C-01', 'P-02', 'BM-010', 'BM-002', -2, 'medium', 'done', { doneHoursAgo: 44 }),
  ]

  const comments = [
    { id: 'CM-1', taskId: 'T-103', authorId: 'BM-005', text: '@Riya I need the hook lines for all 3 reels before I can lock the edit. Can you send today?', at: ago(5) },
    { id: 'CM-2', taskId: 'T-103', authorId: 'BM-006', text: 'On it — will share by 4 pm.', at: ago(4) },
    { id: 'CM-3', taskId: 'T-108', authorId: 'BM-010', text: '@Akshay campaign is in draft. Pixel purchase event verified. Ready for your review.', at: ago(3) },
    { id: 'CM-4', taskId: 'T-101', authorId: 'BM-003', text: 'Carousel 2 looks great. Please keep the logo size consistent across all six.', at: ago(7) },
    { id: 'CM-5', taskId: 'T-115', authorId: 'BM-008', text: '@Dipika keyword sheet is ready for review. Andheri and Powai have very low volume — suggestions inside.', at: ago(9) },
    { id: 'CM-6', taskId: 'T-118', authorId: 'BM-011', text: '@Vinay the film is cut, just waiting on the logo sting to finish the end card.', at: ago(2) },
  ]

  const a = (id, hours, actorId, type, text, extra = {}) => ({ id, at: ago(hours), actorId, type, text, ...extra })
  const activity = [
    a('A-01', 1.5, 'BM-011', 'blocked', 'marked "Edit bridal campaign hero film (60s)" as blocked — waiting on Vinay', { taskId: 'T-118', clientId: 'C-05', targetId: 'BM-005' }),
    a('A-02', 2, 'BM-011', 'comment', 'commented on "Edit bridal campaign hero film (60s)"', { taskId: 'T-118', clientId: 'C-05', targetId: 'BM-005' }),
    a('A-03', 3, 'BM-010', 'status', 'moved "Set up Winter Glow Meta campaign (3 ad sets)" to In review', { taskId: 'T-108', clientId: 'C-01', targetId: 'BM-002' }),
    a('A-04', 4, 'BM-006', 'comment', 'commented on "Edit 3 reels from café shoot (30s each)"', { taskId: 'T-103', clientId: 'C-02', targetId: 'BM-005' }),
    a('A-05', 5, 'BM-005', 'assigned', 'assigned "Hook lines + on-screen text for café reels" to Riya', { taskId: 'T-104', clientId: 'C-02', targetId: 'BM-006' }),
    a('A-06', 5.2, 'BM-005', 'blocked', 'marked "Edit 3 reels from café shoot (30s each)" as blocked — waiting on Riya', { taskId: 'T-103', clientId: 'C-02', targetId: 'BM-006' }),
    a('A-07', 7, 'BM-003', 'comment', 'commented on "Design 6 carousel posts for Winter Glow range"', { taskId: 'T-101', clientId: 'C-01', targetId: 'BM-007' }),
    a('A-08', 9, 'BM-008', 'status', 'moved "Keyword research for 12 gym locations" to In review', { taskId: 'T-115', clientId: 'C-04', targetId: 'BM-004' }),
    a('A-09', 20, 'BM-002', 'assigned', 'assigned "Motion logo sting for Kalakar bridal film" to Vinay', { taskId: 'T-105', clientId: 'C-05', targetId: 'BM-005' }),
    a('A-10', 22, 'BM-003', 'assigned', 'assigned "Write captions + hashtags for December calendar" to Riya', { taskId: 'T-102', clientId: 'C-01', targetId: 'BM-006' }),
    a('A-11', 26, 'BM-006', 'status', 'completed "November blog posts (4) — FitNation"', { taskId: 'T-127', clientId: 'C-04', targetId: 'BM-004' }),
    a('A-12', 28, 'BM-001', 'assigned', 'assigned "Festive campaign media plan" to Akshay', { taskId: 'T-120', clientId: 'C-05', targetId: 'BM-002' }),
    a('A-13', 30, 'BM-009', 'status', 'completed "Install conversion tracking on microsite"', { taskId: 'T-126', clientId: 'C-03', targetId: 'BM-004' }),
    a('A-14', 44, 'BM-010', 'status', 'completed "Retargeting audience setup — Aurora"', { taskId: 'T-128', clientId: 'C-01', targetId: 'BM-002' }),
    a('A-15', 50, 'BM-005', 'status', 'completed "November reels batch — Aurora"', { taskId: 'T-124', clientId: 'C-01', targetId: 'BM-003' }),
    a('A-16', 96, 'BM-001', 'client', 'assigned client Kalakar Jewels to Akshay', { clientId: 'C-05', targetId: 'BM-002' }),
    a('A-17', 100, 'BM-001', 'project', 'created project "Bridal Line Festive Campaign" for Kalakar Jewels', { clientId: 'C-05' }),
  ]

  return { employees, clients, projects, tasks, comments, activity }
}
