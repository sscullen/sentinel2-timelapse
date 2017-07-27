import React from 'react'

export default class Main extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            value: 'Enter username here',
            age: 0
        }

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);

        this.handleAgeSubmit = this.handleAgeSubmit.bind(this);
        this.handleAgeChange = this.handleAgeChange.bind(this);
    }

    handleSubmit(event) {
        this.props.changeUsername(this.state.value);
        event.preventDefault();
    }

    handleChange(event) {
        this.setState({...this.state,
                        value: event.target.value})
    }

    handleAgeSubmit(event) {
        this.props.changeAge(this.state.age);
        event.preventDefault();
    }

    handleAgeChange(event) {
        this.setState({...this.state,
                    age: event.target.value})
    }

    render() {
        return (
            <div>
                <div className="row">
                    <div className="col-xs-12">
                        <h1>The Main Page</h1>
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-12">
                        <input type="text" value={this.state.value} onChange={this.handleChange} />
                        <button className="btn btn-primary"
                                onClick={this.handleSubmit}>
                            Change the Username
                        </button>
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-12">
                        <input type="text" value={this.state.age} onChange={this.handleAgeChange} />
                        <button className="btn btn-primary"
                                onClick={this.handleAgeSubmit}>
                            Change the Age
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
