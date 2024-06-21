import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Modal from '@mui/material/Modal';

const ViewQuickPlan = () => {
    const { planId, clientId } = useParams();
    const [demoPlan, setDemoPlan] = useState({});
    const [error, setError] = useState('');
    const [editableData, setEditableData] = useState({});
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const navigate = useNavigate();
    const [emailSending, setEmailSending] = useState(false);
    const [isUseMode, setIsUseMode] = useState(false);
    const [intensity, setIntensity] = useState('Moderate');
    const [currentDay, setCurrentDay] = useState('Select');
    const [currentProgress, setCurrentProgress] = useState({});
    const [visibleInputs, setVisibleInputs] = useState({});
    const [combinedText, setCombinedText] = useState('');
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [workoutRating, setWorkoutRating] = useState('5');
    const [completionStatus, setCompletionStatus] = useState(false);
    const [completionDate, setCompletionDate] = useState(null);

    useEffect(() => {
        axios.get(`http://localhost:5000/api/get_demo_plan/${planId}`)
            .then(response => {
                const planData = response.data;
                setDemoPlan(planData);
                setCombinedText(generateCombinedText(planData));
                setIntensity(planData.intensity || 'Moderate');
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                setError('Failed to fetch data');
                setLoading(false);
            });
    }, [planId]);

    const getExercisesFromPlanDetails = (planDetails, day) => {
        if (!planDetails) return { warmUp: [], exercises: [] };

        let dayDetails;
        if (day === 'Select') {
            return planDetails;
        } else {
            const dayStart = planDetails.indexOf(`## ${day}`);
            const dayEnd = planDetails.indexOf(`## Day `, dayStart + 1);
            dayDetails = planDetails.substring(dayStart, dayEnd !== -1 ? dayEnd : undefined);
        }

        const lines = dayDetails.split('\n');
        const warmUp = [];
        const exercises = [];
        let currentSection = null;
        let currentExercise = null;

        lines.forEach((line, index) => {
            const isWarmUpSection = /### Warm-Up/i.test(line);
            const isExerciseLine = /(\d+\.\s|\*\*Exercise|\*\*Exercise:)/i.test(line);
            const isDetailLine = /(\*\*Sets|\*\*Reps|\*\*Rest|\*\*Alternative|\*\*Intensity|\*\*Weight|\*\*Notes)/i.test(line);
            const isEndSection = /### Main Workout|### Cool Down|### Notes|###/i.test(line);

            if (isWarmUpSection) {
                currentSection = 'warmUp';
            } else if (isEndSection) {
                currentSection = null;
                if (currentExercise) exercises.push(currentExercise);
                currentExercise = null;
            }

            if (currentSection === 'warmUp') {
                warmUp.push(line);
            } else {
                if (isExerciseLine) {
                    if (currentExercise) exercises.push(currentExercise);
                    currentExercise = { text: line, details: [], index };
                } else if (currentExercise && isDetailLine) {
                    currentExercise.details.push(line);
                }
            }
        });

        if (currentExercise) exercises.push(currentExercise);

        return { warmUp, exercises };
    };
    const toggleEditMode = () => {
        if (!isEditMode) {
            setEditableData({ ...demoPlan });
        }
        setIsEditMode(!isEditMode);
    };

    const cancelEditMode = () => {
        setIsEditMode(false);
        setEditableData(demoPlan);
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setEditableData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const saveChanges = () => {
        axios.post(`http://localhost:5000/api/update_client_demo_plan/${planId}`, {
            name: editableData.demo_plan_name,
            demo_plan_details: editableData.demo_plan_details
        })
            .then(response => {
                setDemoPlan({ ...editableData });
                setIsEditMode(false);
            })
            .catch(error => {
                console.error("Failed to update the workout plan", error.response ? error.response.data : "No response");
                setError("Failed to update the workout plan: " + (error.response ? error.response.data.message : "No response data"));
                setIsEditMode(true);
            });
    };

    const sendEmail = () => {
        setEmailSending(true);
        axios.post('http://localhost:5000/api/email_plan_to_client', {
            client_id: clientId,
            demo_plan_details: demoPlan.demo_plan_details
        })
            .then(response => {
                alert('Email sent successfully!');
                setEmailSending(false);
            })
            .catch(error => {
                const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
                console.error('Failed to send email:', errorMessage);
                alert('Failed to send email: ' + errorMessage);
                setEmailSending(false);
            });
    };

    const enterUseMode = () => {
        setIsUseMode(true);
        setCombinedText(generateCombinedText(demoPlan, currentDay));
    };

    const exitUseMode = () => {
        setIsUseMode(false);
    };

    const openCompleteModal = () => {
        setEditableData(prevState => ({
            ...prevState,
            demo_plan_date: format(new Date(), 'yyyy-MM-dd')
        }));
        setShowCompleteModal(true);
    };
    const closeCompleteModal = () => setShowCompleteModal(false);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    const markAsCompleted = async () => {
        try {
            const { exercises } = getExercisesFromPlanDetails(demoPlan.demo_plan_details, currentDay);
            const progress = exercises.map((exercise, index) => ({
                exercise: exercise.text,
                weight: currentProgress[exercise.index]?.weight || '',
                notes: currentProgress[exercise.index]?.notes || '',
            }));

            const response = await axios.post(`http://localhost:5000/api/mark_plan_completed/${planId}`, {
                client_id: clientId,
                name: editableData.demo_plan_name,
                date: editableData.demo_plan_date,
                workout_type: 'Quick Plan',
                duration_minutes: editableData.duration || 60,
                combined_text: combinedText,
                intensity_level: 'Moderate',
                location: editableData.location || 'Local Gym',
                workout_rating: workoutRating,
                trainer_notes: editableData.trainer_notes || '',
                plan_type: 'quick'
            });

            console.log('Plan marked as completed and logged as workout:', response.data);
            setShowCompleteModal(false);
            setCompletionStatus(true);
            setCompletionDate(response.data.workout_log_id.date);
            alert('Workout completed and successfully logged!');
            setIsUseMode(false);

        } catch (error) {
            console.error('Failed to mark the plan as completed:', error.response ? error.response.data : error.message);
            alert('Failed to mark the plan as completed.');
        }
    };

    const logProgress = (exerciseIndex, field, value) => {
        setCurrentProgress(prevState => ({
            ...prevState,
            [exerciseIndex]: {
                ...prevState[exerciseIndex],
                [field]: value
            }
        }));
    };

    const toggleVisibility = (index) => {
        setVisibleInputs(prevState => ({
            ...prevState,
            [index]: !prevState[index]
        }));
    };

    const handleDayChange = (e) => {
        setCurrentDay(e.target.value);
        setCombinedText(generateCombinedText(demoPlan, e.target.value));
    };

    const generateCombinedText = (plan, day) => {
        const { exercises } = getExercisesFromPlanDetails(plan.demo_plan_details, day);
        let combinedText = '';

        exercises.forEach((exercise, index) => {
            combinedText += exercise.text + '\n';
            combinedText += exercise.details.join('\n') + '\n';
            combinedText += `**Weight:** ${currentProgress[exercise.index]?.weight || ''}\n`;
            combinedText += `**Notes:** ${currentProgress[exercise.index]?.notes || ''}\n\n`;
        });

        return combinedText.trim();
    };

    const renderPlanDetails = (planDetails, isUseMode, currentProgress, logProgress, toggleVisibility, visibleInputs) => {
        if (typeof planDetails === 'string') {
            return planDetails.split('\n').map((line, index) => (
                <div key={index} className={line.trim().startsWith('#') || line.trim().startsWith('##') ? "mt-4 mb-2 font-semibold" : line.trim() === '' ? "mb-2" : "ml-4 text-gray-600"}>
                    {line.trim()}
                </div>
            ));
        } else {
            return (
                <>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Warm-Up:</h3>
                    {planDetails.warmUp.map((line, index) => (
                        <div key={index} className="ml-4 text-gray-600">
                            {line}
                        </div>
                    ))}
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Main Workout:</h3>
                    {planDetails.exercises.map((exercise, index) => {
                        const isVisible = visibleInputs[index] || false;
                        return (
                            <div key={index} className="mb-4">
                                <div>{exercise.text}</div>
                                {exercise.details.map((detail, detailIndex) => (
                                    <div key={detailIndex} className="ml-4 text-gray-600">
                                        {detail}
                                    </div>
                                ))}
                                {isUseMode && (
                                    <div>
                                        {isVisible ? (
                                            <div className="flex space-x-2 mt-2">
                                                <textarea
                                                    value={currentProgress[exercise.index]?.weight || ''}
                                                    placeholder="Weight"
                                                    onChange={(e) => logProgress(exercise.index, 'weight', e.target.value)}
                                                    className="w-1/4 p-2 border rounded"
                                                />
                                                <textarea
                                                    value={currentProgress[exercise.index]?.notes || ''}
                                                    placeholder="Notes"
                                                    onChange={(e) => logProgress(exercise.index, 'notes', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                />
                                                <button onClick={() => toggleVisibility(index)} className="text-red-500 hover:text-red-700 transition-colors duration-300 ease-in-out">
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => toggleVisibility(index)} className="text-blue-500 hover:text-blue-700 transition-colors duration-300 ease-in-out mt-2">
                                                Add Log
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            );
        }
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-6" style={{ color: 'black' }}>
            {isUseMode ? (
                <>
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">Today's Session</h1>
                    <div className="text-lg font-semibold text-gray-700 mb-2">
                        Client: <span className="font-normal">{demoPlan.client_first_name} {demoPlan.client_last_name}</span>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={exitUseMode} className="px-4 py-2 border border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                            Exit Use Mode
                        </button>
                        <button onClick={isEditMode ? saveChanges : toggleEditMode} className="px-4 py-2 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                            {isEditMode ? 'Save Changes' : 'Edit Plan'}
                        </button>
                        {isEditMode && (
                            <button onClick={cancelEditMode} className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                                Cancel
                            </button>
                        )}
                    </div>
                    <div className="mt-4 bg-gray-100 p-4 rounded">
                        <h2 className="text-gray-800 font-semibold mb-2">Workout Details:</h2>
                        <div className="text-gray-600 whitespace-pre-wrap">
                            {isEditMode ? (
                                <textarea
                                    rows="25"
                                    value={editableData.demo_plan_details}
                                    onChange={(e) => setEditableData({
                                        ...editableData,
                                        demo_plan_details: e.target.value  // Update editableData on change
                                    })}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                ></textarea>
                            ) : (
                                renderPlanDetails(getExercisesFromPlanDetails(demoPlan.demo_plan_details, currentDay), isUseMode, currentProgress, logProgress, toggleVisibility, visibleInputs)
                            )}
                        </div>
                    </div>

                    <div className="mt-4">
                        <button onClick={openCompleteModal} className="px-4 py-2 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                            Mark as Completed
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">Workout Details:</h1>
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p className="text-red-500">{error}</p>
                    ) : (
                        <div>
                            <div className="text-lg font-semibold text-gray-700 mb-2">
                                Client: <span className="font-normal">{demoPlan.client_first_name} {demoPlan.client_last_name}</span>
                            </div>
                            <div className="text-lg font-semibold text-gray-700 mb-2">
                                Plan Name: {isEditMode ? (
                                    <input
                                        type="text"
                                        name="demo_plan_name"
                                        value={editableData.demo_plan_name}
                                        onChange={handleInputChange}
                                        className="ml-2 p-1 border rounded"
                                    />
                                ) : (
                                    <span className="font-normal">{editableData.demo_plan_name}</span>
                                )}
                            </div>
                            <div className="text-lg font-semibold text-gray-700">
                                Plan Created: <span className='font-normal'>{formatDate(demoPlan.demo_plan_date)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <div>
                                    <label className="text-lg font-semibold text-gray-700">Select Day:</label>
                                    <select value={currentDay} onChange={handleDayChange} className="ml-2 p-1 border rounded">
                                        <option value="Select">Select</option>
                                        <option value="Day 1: Strength and Power">Day 1</option>
                                        <option value="Day 2: High-Intensity Interval Training (HIIT) and Agility">Day 2</option>
                                        <option value="Day 3: Endurance and Functional Movements">Day 3</option>
                                    </select>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={isEditMode ? saveChanges : toggleEditMode} className="px-4 py-2 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                                        {isEditMode ? 'Save Changes' : 'Edit Plan'}
                                    </button>
                                    {isEditMode && (
                                        <button onClick={cancelEditMode} className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                                            Cancel
                                        </button>
                                    )}
                                    <button onClick={sendEmail} disabled={emailSending} className="px-4 py-2 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                                        {emailSending ? 'Sending...' : 'Email to Client'}
                                    </button>
                                    {!isUseMode && (
                                        <button onClick={enterUseMode} className="px-4 py-2 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-colors duration-300 ease-in-out rounded">
                                            Use for Today's Session
                                        </button>
                                    )}
                                    <button onClick={() => navigate(-1)} className="px-4 py-2 text-white bg-gray-400 hover:bg-gray-600 transition-colors duration-300 ease-in-out rounded">
                                        Return Back
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 bg-gray-100 p-4 rounded">
                                <h2 className="text-gray-800 font-semibold mb-2">Workout Details:</h2>
                                {isEditMode ? (
                                    <textarea
                                        rows="20"
                                        value={editableData.demo_plan_details}
                                        onChange={(e) => setEditableData({
                                            ...editableData,
                                            demo_plan_details: e.target.value
                                        })}
                                        className="w-full p-2 border rounded"
                                    />
                                ) : (
                                    renderPlanDetails(getExercisesFromPlanDetails(demoPlan.demo_plan_details, currentDay), isUseMode, currentProgress, logProgress, toggleVisibility, visibleInputs)
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            {showCompleteModal && (
                <Modal
                    open={showCompleteModal}
                    onClose={closeCompleteModal}
                    aria-labelledby="simple-modal-title"
                    aria-describedby="simple-modal-description"
                >
                    <div className="bg-white p-8 rounded shadow-lg max-h-screen overflow-y-auto max-w-lg mx-auto my-4">
                        <h2 className="text-xl font-bold mb-4">Mark Plan as Completed</h2>
                        <form>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Workout Name</label>
                                <input
                                    type="text"
                                    name="demo_plan_name"
                                    value={editableData.demo_plan_name}
                                    onChange={handleInputChange}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Date Completed</label>
                                <input
                                    type="date"
                                    name="demo_plan_date"
                                    value={editableData.demo_plan_date}
                                    onChange={handleInputChange}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Exercises:</label>
                                <textarea
                                    value={combinedText}
                                    onChange={(e) => setCombinedText(e.target.value)}
                                    className="w-full p-2 border rounded"
                                    rows={15}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Workout Rating (1-10):</label>
                                <div className="flex space-x-2">
                                    {[...Array(10).keys()].map((i) => (
                                        <label key={i} className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                name="workoutRating"
                                                value={i + 1}
                                                checked={workoutRating === String(i + 1)}
                                                onChange={(e) => setWorkoutRating(e.target.value)}
                                                className="form-radio text-indigo-600"
                                            />
                                            <span className="ml-2">{i + 1}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={markAsCompleted}
                                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                >
                                    Log Session
                                </button>
                                <button
                                    type="button"
                                    onClick={closeCompleteModal}
                                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                >
                                    Exit
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ViewQuickPlan;
