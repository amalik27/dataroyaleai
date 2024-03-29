import time
from flask import Flask, request, jsonify
import math

app = Flask(__name__)

@app.route('/', methods=['POST'])
def calculate_hypotenuse():
    time.sleep(2) #Pretend it is a long calculation
    data = request.get_json()
    r = data['r']
    g = data['g']
    v = data['v']
    F = -1*r*g*v
    return jsonify({"Buoyant Force": F})

if __name__ == '__main__':
    app.run(debug=True)

