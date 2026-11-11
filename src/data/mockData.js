export const familyMembers = [
  { id: 'blessing', name: 'Blessing', color: '#3F7097' },
  { id: 'pearl',    name: 'Pearl',    color: '#A35A2B' },
]

export const events = [
  { id: 1,  title: 'Work Shift',       memberId: 'blessing', date: '2026-07-08', time: '09:00', endTime: '17:00' },
  { id: 2,  title: 'Dinner Together',  memberId: null,       date: '2026-07-08', time: '18:30', endTime: '20:00' },
  { id: 3,  title: 'Writing Hour',     memberId: 'blessing', date: '2026-07-09', time: '10:00', endTime: '11:00' },
  { id: 4,  title: "Pearl's Birthday", memberId: 'pearl',    date: '2026-07-10', allDay: true },
  { id: 5,  title: 'Dentist',          memberId: 'blessing', date: '2026-07-11', time: '10:30', endTime: '11:30' },
  { id: 6,  title: 'Yoga Class',       memberId: 'pearl',    date: '2026-07-12', time: '08:00', endTime: '09:00' },
  { id: 7,  title: 'Date Night',       memberId: null,       date: '2026-07-14', time: '19:30', endTime: '22:00' },
  { id: 8,  title: 'Work Shift',       memberId: 'blessing', date: '2026-07-15', time: '09:00', endTime: '17:00' },
  { id: 9,  title: 'Book Club',        memberId: 'pearl',    date: '2026-07-16', time: '19:00', endTime: '21:00' },
  { id: 10, title: 'Gym',              memberId: 'blessing', date: '2026-07-17', time: '07:00', endTime: '08:30' },
  { id: 11, title: 'Movie Night',      memberId: null,       date: '2026-07-19', time: '20:00', endTime: '22:30' },
  { id: 12, title: 'Hair Appointment', memberId: 'pearl',    date: '2026-07-22', time: '11:00', endTime: '13:00' },
  { id: 13, title: 'Weekend Trip',     memberId: null,       date: '2026-07-25', allDay: true },
  { id: 14, title: 'Weekend Trip',     memberId: null,       date: '2026-07-26', allDay: true },
  { id: 15, title: 'Work Shift',       memberId: 'blessing', date: '2026-07-28', time: '09:00', endTime: '17:00' },
]

export const initialChores = {
  blessing: [
    { id: 1, task: 'Groceries',          done: false },
    { id: 2, task: 'Pay rent',           done: true  },
    { id: 3, task: 'Take out trash',     done: false },
    { id: 4, task: 'Vacuum living room', done: false },
  ],
  pearl: [
    { id: 5, task: 'Do laundry',         done: false },
    { id: 6, task: 'Dishes',             done: true  },
    { id: 7, task: 'Wipe counters',      done: false },
    { id: 8, task: 'Schedule dentist',   done: false },
  ],
}
