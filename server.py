from flask_app.controllers import trainer_controller, client_controller, consultation_controller, assessment_controller, history_controller, highlights_controller, generate_plan_controller, workouts_controller
from flask_app import app

if __name__ == "__main__":
    app.run(debug=True)