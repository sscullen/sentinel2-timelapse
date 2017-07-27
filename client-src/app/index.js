import React from 'react'
import { render } from 'react-dom'

import { Provider } from 'react-redux'


import App from './containers/App'

import store from './store'


// provider used in the main render function
// you have to wrap your app in the Provider component to connect from REDUX to all the components
render(<Provider store={store}>
        <App />
    </Provider>,
    window.document.getElementById("app"));
