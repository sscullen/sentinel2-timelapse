// ES6 default values for function parameters
const mathReducer = (state = {
    result: 1,
    lastValues: []
}, action) => {

    switch(action.type) {
        case 'ADD':
            // make sure to create a new state and update your state properties in an immutable way
            // otherwise redux will not work
            state = {
                ...state,
                result: state.result + action.payload,
                lastValues: [...state.lastValues, action.payload]
            }

            break;
        case 'SUBTRACT':
            state = {
                ...state,
                result: state.result - action.payload,
                lastValues: [...state.lastValues, action.payload]
            }

            break;
        default:
            break;
    }

    return state
};

export default mathReducer