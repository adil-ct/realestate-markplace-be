import moment from 'moment';

const dateFormats = {
  getCurrentDateTime: () => moment().utc().toDate(),
  dateToUtc: (date) => moment(date).utc().toDate(),
  dateToUtcStartDate: (date) => moment(new Date(date)).utc().startOf('day').toISOString(),
  dateToUtcEndDate: (date) => moment(new Date(date)).utc().endOf('day').toISOString(),
};

export default dateFormats;
