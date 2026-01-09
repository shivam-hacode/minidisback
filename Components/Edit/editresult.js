'use client';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, Form, Row, Col, Card, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { HOST } from '../../static';
import moment from 'moment';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';

const EditResultPage = () => {
	const router = useRouter();
	const searchParams = useSearchParams();

	// ✅ Safe way to read params (no Suspense needed)
	const id = searchParams?.get('id');
	const date = searchParams?.get('date');
	const time = searchParams?.get('time');

	const [timess, setTimess] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState({
		categoryname: '',
		date: moment().format('YYYY-MM-DD'),
		number: '',
		result: [],
		next_result: '',
		key: '',
		time: '',
	});

	// Separate selections
	const [selectedDateIdx, setSelectedDateIdx] = useState(null);
	const [selectedTimeIdx, setSelectedTimeIdx] = useState(null);

	useEffect(() => {
		if (id) {
			axios
				.get(`${HOST}/result/${id}`, {
					headers: {
						Authorization: `Bearer ${localStorage.getItem('authToken')}`,
					},
				})
				.then((res) => {
					const data = res.data.response;

					if (data) {
						// Find the date entry that matches the URL param
						const dateEntry = data.result.find((r) => r.date === date);

						// Get times array for the selected date
						const timesArray = dateEntry ? dateEntry.times : [];
						setTimess(timesArray);

						// Find the time entry that matches the URL param
						const timeEntry = timesArray.find((t) => t.time === time);

						setForm({
							categoryname: data.categoryname,
							date: date || data.date,
							number: timeEntry ? timeEntry.number : '',
							result: data.result || [],
							next_result: data.next_result,
							key: data.key,
							time: timeEntry ? timeEntry.time : '',
						});

						// Set selected indices for dropdowns
						const dateIdx = data.result.findIndex((r) => r.date === date);
						setSelectedDateIdx(dateIdx !== -1 ? dateIdx : null);

						const timeIdx = timesArray.findIndex((t) => t.time === time);
						setSelectedTimeIdx(timeIdx !== -1 ? timeIdx : null);

						setLoading(false);
					}
				})
				.catch((err) => {
					console.error(err);
					setLoading(false);
				});
		}
	}, [id, date, time]);

	// Handle selecting date
	const handleSelectDate = (e) => {
		const idx = Number(e.target.value);
		setSelectedDateIdx(idx);
		setSelectedTimeIdx(null); // reset time selection
		setForm((prev) => ({
			...prev,
			time: '',
			number: '',
		}));
	};

	// Handle selecting time
	const handleSelectTime = (e) => {
		const idx = Number(e.target.value);
		setSelectedTimeIdx(idx);

		const selected = form.result[selectedDateIdx].times[idx];
		setForm((prev) => ({
			...prev,
			time: selected.time, // already AM/PM format
			number: selected.number,
		}));
	};

	// Handle input changes
	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	// Handle Update
	const handleUpdate = (e) => {
		e.preventDefault();
		if (selectedDateIdx === null || selectedTimeIdx === null) {
			alert('Please select a date and time entry');
			return;
		}

		const dateEntry = form.result[selectedDateIdx];
		const timeEntry = dateEntry.times[selectedTimeIdx];

		setSaving(true);

		axios
			.put(
				`${HOST}/update-existing-result/${id}`,
				{
					date: dateEntry.date, // ✅ exact date string
					time: timeEntry.time, // ✅ exact time string with AM/PM
					number: form.number,
					next_result: form.next_result,
				},
				{
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${localStorage.getItem('authToken')}`,
					},
				}
			)
			.then((res) => {
				setSaving(false);
				if (res.data.message === 'Result updated successfully') {
					Swal.fire({
						icon: 'success',
						title: 'Success!',
						text: res.data.message,
						timer: 2000,
						showConfirmButton: false,
					});
					router.push('/result-management');
				} else {
					Swal.fire({
						icon: 'error',
						title: 'Error!',
						text: res.data.message,
						timer: 2000,
						showConfirmButton: false,
					});
				}
			})
			.catch((err) => {
				console.error(err);
				setSaving(false);
			});
	};

	if (loading) {
		return (
			<div className='container text-center py-5'>
				<Spinner animation='border' />
			</div>
		);
	}

	return (
		<div className='container py-4'>
			<Card>
				<Card.Header>Edit Result</Card.Header>
				<Card.Body>
					<Form onSubmit={handleUpdate}>
						<Row className='g-3 container'>
							{/* Category */}
							<Col md={4}>
								<Form.Label>Category</Form.Label>
								<Form.Control
									type='text'
									name='categoryname'
									value={form.categoryname}
									onChange={handleChange}
									required
								/>
							</Col>
							{/* Key */}
							<Col md={4}>
								<Form.Label>Key</Form.Label>
								<Form.Control
									type='text'
									name='key'
									value={form.key}
									onChange={handleChange}
									required
								/>
							</Col>
							{/* Main Date */}
							<Col md={4}>
								<Form.Label>Main Date</Form.Label>
								<Form.Control
									type='date'
									name='date'
									value={form.date}
									onChange={handleChange}
									required
								/>
							</Col>

							{/* Select Date Entry */}
							<Col
								md={6}
								className='mt-3'>
								<Form.Label>Select Date Entry</Form.Label>
								<Form.Select
									onChange={handleSelectDate}
									value={selectedDateIdx ?? ''}>
									<option
										value=''
										disabled>
										-- Choose Date --
									</option>
									{form.result.map((r, idx) => (
										<option
											key={idx}
											value={idx}>
											{r.date}
										</option>
									))}
								</Form.Select>
							</Col>

							{/* Select Time Entry */}
							<Col
								md={6}
								className='mt-3'>
								<Form.Label>Select Time Entry</Form.Label>
								<Form.Select
									onChange={handleSelectTime}
									value={selectedTimeIdx ?? ''}>
									<option
										value=''
										disabled>
										-- Choose Time --
									</option>
									{timess.map((t, idx) => (
										<option
											key={idx}
											value={idx}>
											{t.time}
										</option>
									))}
								</Form.Select>
							</Col>

							{/* Number */}
							<Col
								md={6}
								className='mt-3'>
								<Form.Label>Number</Form.Label>
								<Form.Control
									type='text'
									name='number'
									value={form.number}
									onChange={(e) => {
										const val = e.target.value.replace(/\D/g, '');
										if (val.length <= 2) {
											setForm((prev) => ({
												...prev,
												number: val,
											}));
										}
									}}
									maxLength={2}
									disabled={selectedTimeIdx === null}
									required
								/>
							</Col>
						</Row>

						{/* Buttons */}
						<div className='mt-3 text-end'>
							<Button
								type='submit'
								variant='primary'
								disabled={saving}>
								{saving ? 'Updating...' : 'Update Result'}
							</Button>
							<Button
								className='ms-2'
								variant='secondary'
								onClick={() => router.push('/')}>
								Cancel
							</Button>
						</div>
					</Form>
				</Card.Body>
			</Card>
		</div>
	);
};

export default EditResultPage;
