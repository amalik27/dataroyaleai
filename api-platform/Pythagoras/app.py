import time
from flask import Flask, request, jsonify
import math

app = Flask(__name__)

@app.route('/', methods=['POST'])
def calculate_hypotenuse():
    data = request.get_json()
    sleep(1)
    a = data['a']
    b = data['b']
    hypotenuse = math.sqrt(a**2 + b**2)
    return jsonify({"hypotenuse": hypotenuse})

@app.route('/health', methods=['GET'])  # Health check typically uses a GET request
def health_check():
    # Simple health check response. You can expand this to check dependencies or app state if necessary.
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(debug=True)

