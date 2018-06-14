class PromiseResourcePool {

    constructor(promises, resultFunc, poolSize, startDelay){
        console.log(
            'creating promise pool'
        )
        
        this.poolSize = poolSize;
        this.startDelay = startDelay;
        this.tasks = 0;
        this.totaltime = 0;
        
        this.promiseList = promises.map((p) => {
            return this.wrapper(p.promise, ...p.args)
        });

        this.resultList = [];
        this.timeoutObjects = [];
        this.queue = 0;

        this.lastTaskTime = 0;
        this.time = this.startDelay;

        this.myIterator = this.myIteratorFactory(this.promiseList)

        this.resultFunc = resultFunc;
    }

    *myIteratorFactory (arr) {
        for (let i = 0; i < arr.length; i++) {
            yield arr[i]
        }
    }

    wrapper(promise, ...args) {
        return () => promise(...args);
    }

    executor() {

        console.log('Timeout objects list', this.timeoutObjects)
        console.log('queue:  ', this.queue)

        if (this.queue < this.poolSize) {
                
            let next = this.myIterator.next();
            
            if (next.done) {
                if (this.queue == 0) {
                    console.log('THE QUEUE IS EMPTY')
                    this.resultFunc(this.resultList);
                    return;
                }
                return;
            }
            
            this.totaltime = 0;
            let task = next.value();
            this.queue++;

            task.then((result) => {
                    this.timeoutObjects.push(setTimeout(() => {
                        this.queue--;
            
                        this.executor();
                    }, this.startDelay));
                    
                    this.resultList.push(result)
                });
    
            this.timeoutObjects.push(setTimeout(() => {
                    
                this.executor();
               
            }, this.startDelay));
        }

    }
}

function fakePromise(text, ms) {
    return new Promise((resolve, reject) => {
        console.log('[%s] Promise with value %s just started', new Date().toISOString(), text)
        let randomNum = Math.floor((Math.random() * 10) + 1);
        if (randomNum > 5)
            result = 'yes' 
        else
            result = 'no'

        let final = text +':    ' +  result
        setTimeout(() => resolve(final), ms)
    })
}

const exampleFunc = () => {
    
const promArr = [
    { 
        promise: fakePromise, 
        args: ['1st', 10000]
    },   
    { 
        promise: fakePromise, 
        args: ['2nd', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['3rd', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['4th', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['5th', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['6th', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['7th', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['8th', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['9th', 10000]
    },
    { 
        promise: fakePromise, 
        args: ['10th', 10000]
    }
];

let resourcePool = new PromiseResourcePool(promArr, (results) => {
    console.log('ALLL DONE,   ', results)
}, 3, 1000);

resourcePool.executor();
}

const whatFunc = () => {
    console.log('hello?');
};

module.exports = { 
    exampleFunc, fakePromise, PromiseResourcePool, whatFunc
};