import React from 'react';

import styles from "../style/_ResultItem.scss";


const ResultItem = (props) => {
    let classString = 'resultItem';

    if (props.item.selected) {
        console.log('this item is selected')
        classString += ' selected'
    }

    if (props.currentTile === true) {
        classString += ' current';
    }


    return (
        <div className={classString} onClick={(e) => {
            console.log(e.target.classList);
            console.log(e.target.classList.contains('selectControl'))

            if (e.target.classList.contains('selectControl')) {
                console.log('the div was clicked, but it was the checkbox')

            } else {
                props.itemClicked(props.item.uuid, props.resultNumber);
            }
        }}>

            <h1>Result {props.resultNumber + 1}</h1>
            <div className="imageDiv">
                <img className='preview-img' src={props.item.localImageURL} alt={"Satellite preview image for" + props.item.product_name}/>
            </div>
            <div className="infoDiv">
                <h3>Folder Name</h3>
                <p>{props.item.product_name}</p>
                <h3>Product ID</h3>
                <p>{props.item.uuid}</p>
                <p className="date">{props.item.dateObj.format("MMMM Do YYYY, HH:mm:ss zzz")}</p>
                <div className="spaceDiv"></div>
                <div className="selectionDiv">
                    <input id={"selectTile " + props.item.uuid} className='selectControl' type='checkbox' defaultChecked={!!props.item.selected} checked={!!props.item.selected}
                                      onChange={(e) => {

                                          console.log('what is being clicked here', e, props.item.uuid);
                                          props.toggleSelected(props.item.uuid)
                                      }}/>
                    <label className='selectControl' htmlFor={"selectTile " + props.item.uuid}>Select Tile</label>
                </div>
            </div>
        </div>
    );
}

// {this.state.resultsList.map((obj) =>{
//
//     // let formattedDate = moment(obj.date, "")
//
//     return (<li key={ obj.uuid } onClick={(e) => this.setCurrentTile(obj.uuid, e)} dataID={obj.uuid}>
//         Product Folder Name: {obj.product_name}<br/>
//         Product ID: {obj.uuid} <br/>
//         Date: {obj.dateObj.format("MMMM Do YYYY, HH:mm:ss z") } <br/>
//
//         {/*need to authenticate to use the raw url for the images*/}
//         <img src={obj.localImageURL} alt={obj.product_name}/>
//     </li>);

// default props set outside the function
ResultItem.defaultProps = {
    resultNumber: 1
};

export { ResultItem as default }