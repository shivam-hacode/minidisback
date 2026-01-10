import moment from 'moment';
import axios from 'axios';
import { HOST } from '../static';

/**
 * Get the current 15-minute time slot
 * Returns the rounded time (e.g., 10:00, 10:15, 10:30, 10:45)
 */
export const getCurrentTimeSlot = () => {
	const now = moment();
	const rounded = now
		.clone()
		.startOf('minute')
		.add(15 - (now.minute() % 15), 'minutes')
		.seconds(0);
	return rounded;
};

/**
 * Get the next scheduler trigger time (14:45 of current or next slot)
 * Returns the time when scheduler should trigger
 */
export const getNextSchedulerTime = () => {
	const now = moment();
	const currentSlot = getCurrentTimeSlot();
	
	// Calculate 14:45 of current slot
	const triggerTime = currentSlot.clone().add(14, 'minutes').add(45, 'seconds');
	
	// If current time is past 14:45 of current slot, get next slot's 14:45
	if (now.isAfter(triggerTime) || now.isSame(triggerTime)) {
		const nextSlot = currentSlot.clone().add(15, 'minutes');
		return nextSlot.clone().add(14, 'minutes').add(45, 'seconds');
	}
	
	return triggerTime;
};

/**
 * Check if current time is 14:45 of a 15-minute interval
 * Triggers at: 00:14:45, 15:14:45, 30:14:45, 45:14:45
 */
export const isSchedulerTriggerTime = () => {
	const now = moment();
	const minutes = now.minute();
	const seconds = now.second();
	
	// Check if it's exactly 14 minutes 45 seconds into a 15-minute slot
	// Valid trigger times: XX:14:45 where XX is 00, 15, 30, or 45
	const slotStart = minutes - (minutes % 15); // Get the start of current 15-min slot
	const minutesIntoSlot = minutes - slotStart;
	
	// Trigger at 14:45 (14 minutes 45 seconds) into each slot
	return minutesIntoSlot === 14 && seconds === 45;
};

/**
 * Check if a manual entry exists for the current time slot
 */
export const checkManualEntryExists = async (timeSlot, date) => {
	try {
		const response = await axios.get(`${HOST}/fetch-result`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${localStorage.getItem('authToken')}`,
			},
		});

		const results = response.data.data || [];
		const dateFormatted = date || moment().format('YYYY-MM-DD');

		// Get the time slot range (e.g., for 10:00 slot, check 10:00-10:14:59)
		const slotStart = timeSlot.clone().startOf('minute');
		const slotEnd = slotStart.clone().add(14, 'minutes').add(59, 'seconds');

		// Check if any result has a manual entry for this time slot
		for (const result of results) {
			if (result.date === dateFormatted) {
				// Check in result array
				if (result.result && Array.isArray(result.result)) {
					for (const entry of result.result) {
						if (entry.times && Array.isArray(entry.times)) {
							for (const timeEntry of entry.times) {
								// Parse time and check if it falls within the slot window
								const entryTime = moment(timeEntry.time, 'hh:mm A');
								if (entryTime.isValid() && entryTime.isSameOrAfter(slotStart) && entryTime.isSameOrBefore(slotEnd)) {
									return true; // Manual entry exists in this slot
								}
							}
						} else if (entry.time) {
							const entryTime = moment(entry.time, 'hh:mm A');
							if (entryTime.isValid() && entryTime.isSameOrAfter(slotStart) && entryTime.isSameOrBefore(slotEnd)) {
								return true; // Manual entry exists in this slot
							}
						}
					}
				}
				// Also check main time field
				if (result.time) {
					const entryTime = moment(result.time, 'hh:mm A');
					if (entryTime.isValid() && entryTime.isSameOrAfter(slotStart) && entryTime.isSameOrBefore(slotEnd)) {
						return true; // Manual entry exists in this slot
					}
				}
			}
		}

		return false; // No manual entry found
	} catch (error) {
		console.error('Error checking manual entry:', error);
		return true; // On error, assume entry exists (safer to not send auto)
	}
};

/**
 * Send automatic number via scheduler
 */
export const sendAutoNumber = async (timeSlot, number = '00') => {
	try {
		const date = moment().format('YYYY-MM-DD');
		const timeFormatted = timeSlot.format('hh:mm A');
		const nextResult = timeSlot.clone().add(15, 'minutes').format('hh:mm A');

		const response = await axios.post(
			`${HOST}/result`,
			{
				categoryname: 'Minidiswar',
				time: timeFormatted,
				number: number,
				next_result: nextResult,
				result: [
					{
						time: timeFormatted,
						number: number,
					},
				],
				date: date,
				key: 'md-9281',
				phone: '',
				isAutoScheduled: true, // Flag to identify auto-scheduled entries
			},
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${localStorage.getItem('authToken')}`,
				},
			}
		);

		return response.data;
	} catch (error) {
		console.error('Error sending auto number:', error);
		throw error;
	}
};

/**
 * Main scheduler function
 * Should be called every second to check if it's time to trigger
 */
export const runScheduler = async () => {
	if (!isSchedulerTriggerTime()) {
		return false;
	}

	const timeSlot = getCurrentTimeSlot();
	const date = moment().format('YYYY-MM-DD');

	// Check if manual entry exists
	const manualEntryExists = await checkManualEntryExists(timeSlot, date);

	if (manualEntryExists) {
		console.log(`Scheduler: Manual entry exists for ${timeSlot.format('hh:mm A')}, skipping auto send`);
		return false;
	}

	// No manual entry, send auto number
	console.log(`Scheduler: Sending auto number for ${timeSlot.format('hh:mm A')}`);
	try {
		await sendAutoNumber(timeSlot);
		console.log(`Scheduler: Auto number sent successfully for ${timeSlot.format('hh:mm A')}`);
		return true;
	} catch (error) {
		console.error('Scheduler: Failed to send auto number:', error);
		return false;
	}
};

