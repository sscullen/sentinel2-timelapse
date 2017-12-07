import React from 'react'

// react-redux critcal function
import { connect } from 'react-redux'

import { User } from '../components/User'
import Main  from '../components/Main'
import MapContainer from '../components/Main'

// import redux actions for convience
import { setName, setAge } from '../actions/userActions'



import "../style/style.scss"

// to finish the connection between Redux and React, you do not export the component directly
// you must pass your component to the function returned by connect method and export that
class App extends React.Component {


    render() {
        return (
            <div className="container">

                <MapContainer />

            </div>
        )
    }
}

// this map props directly to the names given when reducers are combined with combineReducers func
const mapStateToProps = (state) => {
    return {
        user: state.user,
        math: state.math
    };
};

// this map props directly to the names given when reducers are combined with combineReducers func
const mapDispatchToProps = (dispatch) => {
    return {
        setName: (name) => {
            dispatch(setName(name))
        },
        setAge: (age) => {
            dispatch(setAge(age))
        }
    };
};

// we map our state to props we can use
// we map our actions to functions we can use
// and finally we export the wrapped component at the end of the function to
// instead of the component directly
export default connect(mapStateToProps, mapDispatchToProps)(App)