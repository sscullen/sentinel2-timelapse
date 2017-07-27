// required functions to initialize REDUX
import { createStore, combineReducers, applyMiddleware } from 'redux'
// Logging middleware for redux
import logger from 'redux-logger'
// thunk is used for async actions in redux
import thunk from 'redux-thunk'
// redux-promise-middleware enables support for promises in async actions
import promise from 'redux-promise-middleware'
// import your reducers
import math from './reducers/mathReducer'
import user from './reducers/userReducer'

// ********************************** CREATING YOUR OWN MIDDLEWARE EXAMPLE

// myLogger middleware, middle ware sits between the action and the reducer on the REDUX flow diagram
// function (store) { return function (next) { return function(action) {}}}
// it looks super confusing but just remember how fat arrow funcs in ES6 implicitly return the
// thing directly after the arrow
const myLogger = (store) => (next) => (action) => {
    console.log("Logged action: ", action)
    // need to call next(action) to allow the action to pass to the reducer
    next(action)
}

// ********************************** SUBSCRIBING TO STORE EVENTS EXAMPLE
// RE: above, some middleware can be passed as the function directly, redux-logger has afunction that has to run
// in order to return the chained functions that allow middleware to work
//
// store.subscribe(() => {
//     //console.log('Store updated', store.getState())
// })



export default createStore(
    combineReducers({
        math,
        user
    }),
    {},
    applyMiddleware(logger(), thunk, promise())
);