// optionally prefix your actions and reducers to avoid duplicate action names

// converting to async actions
export function setName(name) {
    // use this way if you are not interested in directely returning promises to the reducer
    // converted to async using thunk package (redux-thunk)
    // return (dispatch) => {
    //     setTimeout(() => {
    //         dispatch({
    //             type: 'USER_SET_NAME',
    //             payload: name
    //         });
    //
    //     }, 2000)
    //
    // }

    // I want to use promises, so use this approach, change your reducer actions to add _FULFILLED
    // example using promises, in order to do this, you need react-promise-middleware
    return {
        type: "USER_SET_NAME",
        payload: new Promise((resolve, reject) => {
            setTimeout(() => {

                resolve(name)
            }, 2000)
        })
    }
}

export function setAge(age) {
    return {
        type: 'USER_SET_AGE',
        payload: new Promise((resolve, reject) => {
            setTimeout(() => {

                resolve(age)
            }, 4000)
        })
    }
}