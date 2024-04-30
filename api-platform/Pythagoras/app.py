import time
from flask import Flask, request, jsonify
import math

app = Flask(__name__)

@app.route('/', methods=['POST'])
def calculate_hypotenuse():
    data = request.get_json()
    a = data['a <number>']
    b = data['b <number>']
    try:
        a = float(a)
        b = float(b)
    except ValueError:
        return jsonify({"error": "Invalid parameters"}), 400
    hypotenuse = math.sqrt(a**2 + b**2)
    return jsonify({"hypotenuse <number>": hypotenuse}), 200

@app.route('/health', methods=['GET'])  # Health check typically uses a GET request
def health_check():
    # Simple health check response. You can expand this to check dependencies or app state if necessary.
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(debug=True)

