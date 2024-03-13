import time
from flask import Flask, request, jsonify
import math

app = Flask(__name__)

@app.route('/', methods=['POST'])
def calculate_hypotenuse():
    time.sleep(2) #Pretend it is a long calculation
    data = request.get_json()
    a = data['a']
    b = data['b']
    hypotenuse = math.sqrt(a**2 + b**2)
    return jsonify({"hypotenuse": hypotenuse})

if __name__ == '__main__':
    app.run(debug=True)

