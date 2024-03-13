from flask import Flask
import time

app = Flask(__name__)

@app.route('/')

def hello_world():
        time.sleep(5);#Imagine this as the system taking some time to do work.
        return "Hello World!"
